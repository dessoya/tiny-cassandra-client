'use strict'

var cqlVersion = '3.0.0'

var errorCodes = {
	0x2000:			'Syntax_error: The submitted query has a syntax error.',
	0x2200:			'Invalid: The query is syntactically correct but invalid.',
	0x2400:			'Already_exists: The query attempted to create a keyspace or a table that was already existing.',
}

var opcodes = {
	error:			0x00,
	startup:		0x01,
	ready:			0x02,
	authenticate:	0x03,
	options:		0x05,
	supported:		0x06,
	query:			0x07,
	result:			0x08,
	prepare:		0x09,
	execute:		0x0a,
	register:		0x0b,
	event:			0x0c,
	batch:			0x0d,
	auth_challenge:	0x0e,
	auth_response:	0x0f,
	auth_success:	0x10,
}

var results = {
	void:			0x0001,
	rows:			0x0002,
	setKeyspace:	0x0003,
	prepared:		0x0004,
	schemaChange:	0x0005
}

var dataTypes = {
	custom:			0x0000,
	ascii:			0x0001,
	bigint:			0x0002,
	blob:			0x0003,
	boolean:		0x0004,
	counter:		0x0005,
	decimal:		0x0006,
	double:			0x0007,
	float:			0x0008,
	int:			0x0009,
	text:			0x000a,
	timestamp:		0x000b,
	uuid:			0x000c,
	varchar:		0x000d,
	varint:			0x000e,
	timeuuid:		0x000f,
	inet:			0x0010,
	list:			0x0020,
	map:			0x0021,
	set: 			0x0022,
}

module.exports = {
	opcodes:		opcodes,
	results:		results,
	dataTypes:		dataTypes,
	cqlVersion:		cqlVersion,
	errorCodes:		errorCodes,
}