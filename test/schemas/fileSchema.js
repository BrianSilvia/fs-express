'use strict';

const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;

const fileSchema = new Schema({
    _id: String,
    mimeType: String,
    size: Number,
    dateCreated: Date,
    lastModified: Date,
    parents: [String],
    name: String,
});

module.exports = mongoose.model( 'files', fileSchema );
