'use strict'

var Class			= require('class')

var bufferPartSize = 1024

var PacketWriter = Class.inherit({

	onCreate: function(opcode, streamId, flags) {
		this.opcode = opcode
		this.flags = flags || 0
		this.streamId = streamId || 0

		this.buffers = [ ]
		this.sizes = [ ]
		this.appendBuffer(8)
	},

	size: function() {
		this.sizes[ this.buffers.length - 1 ] = this.pos
		var size = 0, sizes = this.sizes, c = sizes.length; while(c--) {
			size += sizes[c]
		}
		this.size = size
		return size
	},

	getBuffer: function() {
		this.writeHeader()

		if(this.buffers.length === 1) {
			return this.buffers[0].slice(0, this.size)
		}

		var buffer = new Buffer(this.size)
		for(var i = 0, pos = 0, sizes = this.sizes, buffers = this.buffers, c = buffers.length; i < c; i ++) {
			var b = buffers[i], size = sizes[i]
			b.copy(buffer, pos, 0, size)
			pos += size
		}
		return buffer
	},

	writeHeader: function(opcode, streamId, flags) {
		var buffer = this.buffers[0]
		buffer.writeUInt8(2, 0, true)
		buffer.writeUInt8(this.flags, 1, true)
		buffer.writeUInt8(this.streamId, 2, true)
		buffer.writeUInt8(this.opcode, 3, true)
		buffer.writeUInt32BE(this.size() - 8, 4, true)
	},

	checkSize: function(size) {
		if( this.pos + size >= this.currentSize ) {
			this.sizes[ this.buffers.length - 1 ] = this.pos
			this.appendBuffer(0)
		}
	},

	appendBuffer: function(pos) {
		this.currentSize = bufferPartSize
		this.pos = pos

		this.buffers.push( this.buffer = new Buffer(bufferPartSize) )
	},

	writeString: function(str) {
		var len = Buffer.byteLength(str, 'utf8')	
		this.writeShort(len)

		this.checkSize(len)
		this.buffer.write(str, this.pos, len, 'utf8')
		this.pos += len
	},

	writeLongString: function(str) {
		var len = Buffer.byteLength(str, 'utf8')	
		this.writeDWord(len)

		this.checkSize(len)
		this.buffer.write(str, this.pos, len, 'utf8')
		this.pos += len
	},

	writeShort: function(num) {
		this.checkSize(2)
		this.buffer.writeUInt16BE(num, this.pos, true)
		this.pos += 2
	},

	writeDWord: function(dword) {
		this.checkSize(4)
		this.buffer.writeUInt32BE(dword, this.pos, true)
		this.pos += 4
	},

	writeByte: function(b) {
		this.checkSize(1)
		this.buffer.writeUInt8(b, this.pos, true)
		this.pos += 1
	},

	writeStringMap: function (map) {
		var keys = 0
		for (var key in map) {
			keys ++
		}

		this.writeShort(keys)

		for (var key in map) {
			this.writeString(key)
			this.writeString(map[key])
		}
	}

})

module.exports = PacketWriter