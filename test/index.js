'use strict';

const chai = require( 'chai' );
const expect = chai.expect;
const chaiaspromised = require( 'chai-as-promised' );
const express = require( 'express' );
const request = require( 'supertest' );
const http = require( 'http' );
const StringDecoder = require( 'string_decoder' ).StringDecoder;
chai.use( chaiaspromised );

const app = express();

function binaryStringParser( res, callback ) {
    const decoder = new StringDecoder( 'utf8' );
    res.setEncoding( 'binary' );
    let data = '';
    res.on( 'data', chunk => {
        data += decoder.write( chunk );
    });
    res.on( 'end', () => {
        callback( null, data );
    });
}

describe( 'functional tests', function() {
    before( function( done ) {
        const dataStore = {
            read: ( resourceId ) => {
                switch ( resourceId ) {
                    case '8d461483-e701-47ca-8788-c6210550fdb9': return Promise.resolve( 'http://localhost:3000/test.txt' );
                    case '614dd78b-0d7b-4777-8aa6-c9d20dfb3032': return Promise.resolve( 'http://localhost:3000/test2.txt' );
                    default: return Promise.reject();
                }
            },
            alias: ( resourceId ) => {
                switch ( resourceId ) {
                    case 'notServedFile.txt': return Promise.resolve({
                        data: {
                            GUID: '8d461483-e701-47ca-8788-c6210550fdb9',
                        },
                    });
                    default: return Promise.reject();
                }
            },
            search: () => {},
            inspect: () => {},
            download: () => {},
            create: () => {},
            bulk: () => {},
            copy: () => {},
            update: () => {},
            move: () => {},
            rename: () => {},
            destroy: () => {},
        };

        const permissions = {
            verify: () => {
                return Promise.resolve();
            },
        };

        const fsExpress = require( '../index.js' );

        app.use( express.static( __dirname + '/testfiles' ));
        // store the userId in req.userId
        app.use(( req, res, next ) => {
            req.userId = 'userId';
            next();
        });
        app.use( fsExpress({ dataStore, permissions }));

        // serve up actual static content to query for
        app.server = http.createServer( app );
        app.server.listen( 3000, done );
    });

    after( function() {
        app.server.close();
    });

    describe( 'get', function() {
        it( 'should return file contents of a plain text file', function( done ) {
            request( app )
            .get( '/8d461483-e701-47ca-8788-c6210550fdb9' )
            .set( 'Accept', 'text/plain' )
            .expect( 'Content-Type', /text\/plain/g )
            .parse( binaryStringParser )
            .expect( res => {
                expect( res.body ).to.equal( 'test text file contents\n' );
            })
            .expect( 200, done );
        });
    });

    describe( 'read', function() {
        it( 'should return file contents of a plain text file', function( done ) {
            request( app )
            .get( '/614dd78b-0d7b-4777-8aa6-c9d20dfb3032' )
            .query({ action: 'read' })
            .set( 'Accept', 'text/plain' )
            .expect( 'Content-Type', /text\/plain/g )
            .parse( binaryStringParser )
            .expect( res => {
                expect( res.body ).to.equal( 'test2 text file contents\n' );
            })
            .expect( 200, done );
        });
    });

    describe.skip( 'search', function() {
        // TODO: finish designing this out
    });

    // fails due to https://github.com/Brinkbit/http-fs-node/issues/18
    describe( 'alias', function() {
        it( 'should return file contents of a plain text file', function( done ) {
            request( app )
            .get( '/notServedFile.txt' )
            .query({ action: 'alias' })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res => {
                expect( res.body ).to.deep.equal({ data: { GUID: '8d461483-e701-47ca-8788-c6210550fdb9' } });
            })
            .expect( 200, done );
        });
    });

    describe.skip( 'inspect', function() {
        it( 'should return file contents of a plain text file', function( done ) {
            request( app )
            .get( '/614dd78b-0d7b-4777-8aa6-c9d20dfb3032' )
            .query({ action: 'read' })
            .set( 'Accept', 'text/plain' )
            .expect( 'Content-Type', /text\/plain/g )
            .parse( binaryStringParser )
            .expect( res => {
                expect( res.body ).to.equal( 'test2 text file contents\n' );
            })
            .expect( 200, done );
        });
    });

    describe( 'put', function() {});
    describe( 'post', function() {});
    describe( 'delete', function() {});
});
