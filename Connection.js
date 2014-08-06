'use strict'

var Class			= require('class')
  , util			= require('util')
  , consts			= require('./consts.js')
  , opcodes			= consts.opcodes
  , results			= consts.results
  , dataTypes		= consts.dataTypes
  , PacketWriter	= require('./PacketWriter.js')
  , PacketReader	= require('./PacketReader.js')
  , uuid			= require('node-uuid')
  , errors			= require('errors')

var maxChannelId = 32

var Connection = Class.inherit({

	onCreate: function(config, parent, socketCreator) {
		this.config = config
		this.parent = parent
		this.socketCreator = socketCreator
		this.connected = false

		var availChannels = this.availChannels = []
		for(var i = 1; i <= maxChannelId; i++) {
			availChannels.push(i)
		}
		this.streams = {}
		this.queue = []

		this.binded_onConnect = this._onConnect.bind(this)
		this.binded_onData = this._onData.bind(this)

		this.open()
	},

	open: function() {

    	this.connected = false
		this.connecting = true

		this.socket = this.socketCreator()

		this.readState = 0
		this.incomingBuffer = new Buffer(0)

		this.socket.on('data', this.binded_onData)

		this.socket.connect(this.config.port, this.config.host, this.binded_onConnect)
	},

	_onData: function(buffer) {

		console.log('C#' + this.config.index + ': _onData')
		console.log(util.inspect(buffer,{depth:null}))

		this.incomingBuffer = Buffer.concat([this.incomingBuffer, buffer])

		while(true) {

			switch(this.readState) {

			case 0:
				if(this.incomingBuffer.length < 8) return
				this.frameLength = this.incomingBuffer.readUInt32BE(4, true)
				this.streamId = this.incomingBuffer.readInt8(2, true)
				this.opcode = this.incomingBuffer.readUInt8(3, true)
				if(this.frameLength === 0) {
					// process
					this.processFrame()
					this.incomingBuffer = this.incomingBuffer.slice(8)		
				}
				else {
					this.readState = 1
				}
				break

			case 1:
				if(this.incomingBuffer.length < 8 + this.frameLength) return
				
				this.processFrame()

				var buffer = new Buffer(this.incomingBuffer.length - 8 - this.frameLength)
				this.incomingBuffer.copy(buffer, 0, 8 + this.frameLength)
				this.incomingBuffer = buffer
				this.readState = 0

				break	
			}
		}

	},


	processFrame: function() {
/*
		console.log('frame '+this.opcode)
		console.log('size '+this.frameLength)
*/
		switch(this.opcode) {

		default:
			console.log('unknown opcode ' + this.opcode)
			break

		case opcodes.ready:
			var usePacket = PacketWriter.create(opcodes.query)

			usePacket.writeLongString('use ' + this.config.keyspace)
			usePacket.writeShort(1)
			usePacket.writeByte(0)

			var buffer = usePacket.getBuffer()
			// console.log(util.inspect(buffer,{depth:null}))
			this.socket.write(buffer)

			break

		case opcodes.error:

			var reader = PacketReader.create(this.incomingBuffer, 8)
			var errorCode = reader.readDWord()
			var errorText = reader.readString()

			var err = { code: errorCode, text: errorText, codeDescription: consts.errorCodes[errorCode] }
			if(this.streamId in this.streams) {
				var stream = this.streams[this.streamId]
				err.stack = stream.stack
				err.query = stream.query
			}

			switch(errorCode) {
			case 0x2400:
				err.errorInfo = { keyspace: reader.readString(), table: reader.readString() }
				break
			}

			this.invokeStreamCallback(this.streamId, err)

			break

		case opcodes.result:

			var reader = PacketReader.create(this.incomingBuffer, 8)
			var resultType = reader.readDWord()

			switch(resultType) {

			default:
				console.log('unknown resultType ' + resultType)
				break

			case results.schemaChange:
				var result = { change: reader.readString(), keyspace: reader.readString(), table: reader.readString() }
				this.invokeStreamCallback(this.streamId, null, result)
				break

			case results.setKeyspace:
				if(!this.connected) {
			    	this.connected = true
					this.parent.connectionReady(this)
					this.processQueue()
					return
				}
				this.invokeStreamCallback(this.streamId, null, true)
				break

			case results.rows:

				var flags = reader.readDWord()
				var c, columns = c = reader.readDWord()
				if(flags & 1) {
					var keyspace = reader.readSkipString()
					var table = reader.readSkipString()
				}	

				var columns = []
				while(c--) {
					var cname = reader.readString()
					var option = reader.readOption()
					columns.push(cname, option)
 				}

				var rowsCount = reader.readDWord()
				var result = { rows: [] }

				while(rowsCount--) {
					var row = {}
					for(var i = 0, l = columns.length;i < l; i++) {
						var c = columns[i++], o = columns[i]
						var bytes = reader.readInt()
						row[c] = bytes < 0 ? null : reader.readValue(o, bytes)
					}
					result.rows.push(row)
				}

				this.invokeStreamCallback(this.streamId, null, result)
				break
			}
			break		
		}
	},

	invokeStreamCallback: function(streamId, err, result) {

		if(streamId in this.streams) {
			this.availChannels.push(streamId)
			var stream = this.streams[streamId]
			delete this.streams[streamId]
			if('function' === typeof stream.callback) {
				stream.callback(err, result)
			}
			this.processQueue()
		}
	},

	_onConnect: function() {

		this.connecting = false
    	this.connected = false

		// console.log('C#' + this.config.index + ': connected')

		var initPacket = PacketWriter.create(opcodes.startup)

		initPacket.writeStringMap({
			CQL_VERSION: consts.cqlVersion
		})

		this.socket.write(initPacket.getBuffer())

		this.processQueue()
	},

	processQueue: function() {
		while(this.connected && this.queue.length && this.availChannels.length) {
			var queryObject = this.queue.shift()
			this.query(queryObject)
		}
	},

	query: function(query, consistency, callback) {

		var queryObject = 'object' === typeof query ? query : { query: query, consistency: consistency, callback: callback }

		if(!queryObject.stack) {
			var stack = errors.Common.create(new Error).stack
			stack.shift()
			stack.shift()
			queryObject.stack = stack
		}
		
		if(this.availChannels.length < 1 || !this.connected) {
			this.queue.push(queryObject)
			return
		}

		var streamId = this.availChannels.shift()
		this.streams[streamId] = queryObject
		var queryPacket = PacketWriter.create(opcodes.query, streamId)

		queryPacket.writeLongString(queryObject.query)
		queryPacket.writeShort(queryObject.consistency)
		queryPacket.writeByte(0)

		var buffer = queryPacket.getBuffer()
		// console.log(util.inspect(buffer,{depth:null}))
		this.socket.write(buffer)
	}

})

Connection.maxChannelId = maxChannelId

module.exports = Connection