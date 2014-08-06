'use strict'

var Class			= require('class')
  , Connection		= require('./Connection.js')
  , net				= require('net')

var net_socketCreator = function() {
	return new net.Socket()
}

var Client = Class.inherit({
	onCreate: function(config, readyCallback, socketCreator) {
		socketCreator = socketCreator || net_socketCreator
		this.readyCallback = readyCallback
		this.config = config
		var connections = this.connections = []
		var hosts = config.hosts, hostCount = hosts.length
		this.connectionInProgress = config.poolSize
		for (var i = 0, c = config.poolSize; i < c;) {
			for (var j = 0; j < hostCount && i < c; i++, j++) {
				var host = hosts[j]
				var connectionConfig = { host: host, port: 9042, index: i, keyspace: config.keyspace }
				var connection = Connection.create(connectionConfig, this, socketCreator)
				connections.push(connection)
			}
		}
	},

	connectionReady: function(connection) {
		this.connectionInProgress --
		if(this.connectionInProgress === 0) {
			if(this.readyCallback) {
				this.readyCallback()
			}
		}
	},

	getConnection: function() {
		var avail = -1, availConnection = null
		for(var i = 0, c = this.connections, l = c.length; i < l; i++) {
			var connection = c[i], channels = connection.availChannels.length
			if(channels === Connection.maxChannelId) return connection
			if(channels > avail) {
				avail = channels
				availConnection = connection
			}		
		}
		return availConnection
	},

	query: function(query, consistency, callback) {

		if(!callback) {
			callback = consistency
			consistency = 1
		}

		var connection = this.getConnection()
		connection.query(query, consistency, callback)
	}
})

module.exports = Client