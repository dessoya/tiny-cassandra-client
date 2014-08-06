'use strict'

var Class			= require('class')
  , uuid			= require('node-uuid')
  , util			= require('util')
  , consts			= require('./consts.js')
  , opcodes			= consts.opcodes
  , results			= consts.results
  , dataTypes		= consts.dataTypes

var PacketReader = Class.inherit({

	onCreate: function(buffer, pos) {
		this.buffer = buffer
		this.pos = pos
	},

	readDWord: function() {
		var i = this.buffer.readUInt32BE(this.pos, true)
		this.pos += 4
		return i
	},

	readInt: function() {
		var i = this.buffer.readInt32BE(this.pos, true)
		this.pos += 4
		return i
	},

	readShort: function() {
		var i = this.buffer.readUInt16BE(this.pos, true)
		this.pos += 2
		return i
	},

	readString: function() {
		var len = this.readShort()
  		var str = this.buffer.toString('utf8', this.pos, this.pos + len)
		this.pos += len
		return str
	},

	readSkipString: function() {
		var len = this.readShort()
		this.pos += len
	},

	readOption: function () {
		var id = this.readShort()

		switch(id) {

		case 0x0000: 
        	return [id, this.readString()]

		case 0x0001:
		case 0x0002:
		case 0x0003:
		case 0x0004:
		case 0x0005:
		case 0x0006:
		case 0x0007:
		case 0x0008:
		case 0x0009:
		case 0x000A:
		case 0x000B:
		case 0x000C:
		case 0x000D:
		case 0x000E:
		case 0x000F:
		case 0x0010:
		    return [id];

		// list
		case 0x0020:
			var type = this.readOption()
		    return [id, type[0]]

		// map
		case 0x0021:
			var typeKey = this.readOption()
			var typeValue = this.readOption()
		    return [id, typeKey[0], typeValue[0]]

		// set
		case 0x0022:
			var type = this.readOption()
		    return [id, type[0]]
		}

		return [id]
	},

	readValue: function(typeInfo, bytes) {
		var type = typeInfo[0], value = null
		switch(type) {

			case dataTypes.bigint:
				var v1 = this.buffer.readInt32BE(this.pos, true)
				var v2 = this.buffer.readUInt32BE(this.pos + 4, true)
				value = v2 + v1 * 0x0100000000
				this.pos += 8
				break

			case dataTypes.blob:
				value = this.buffer.toString('hex', this.pos, this.pos + bytes)
				this.pos += bytes
				break

			case dataTypes.int:
				value = this.buffer.readInt32BE(this.pos, true)
				this.pos += 4
				break

			case dataTypes.uuid:
			case dataTypes.timeuuid:
				value = uuid.unparse(this.buffer, this.pos)
				this.pos += 16
				break

			case dataTypes.varchar:
				value = this.buffer.toString('utf8', this.pos, this.pos + bytes)
				this.pos += bytes
				break

			case dataTypes.boolean:
				value = !!this.buffer.readUInt8(this.readPos, true)
				this.pos ++
				break

			case dataTypes.double:
				value = this.buffer.readDoubleBE(this.pos, true)
				this.pos += 8
				break

			case dataTypes.list:
				value = []
				var itemType = typeInfo[1]
			    var totalItems = this.buffer.readUInt16BE(this.pos, true)
				this.pos += 2
				for(var i = 0; i < totalItems; i++) {
			    	bytes = this.buffer.readUInt16BE(this.pos, true)
					this.pos += 2
					value.push(this.readValue([itemType], bytes))
				}
				break

			default:
				console.log('unknown type: ' + type)
		}

		return value
	},

})

module.exports = PacketReader