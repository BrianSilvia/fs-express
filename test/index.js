'use strict';

const chai = require( 'chai' );
const expect = chai.expect;
const chaiaspromised = require( 'chai-as-promised' );
const express = require( 'express' );
const supertest = require( 'supertest' );
const request = require( 'request' );
const http = require( 'http' );
const bluebird = require( 'bluebird' );
const fs = bluebird.promisifyAll( require( 'fs-extra' ));
const buffertools = require( 'buffertools' );
chai.use( chaiaspromised );

const app = express();

function binaryParser( res, callback ) {
    res.setEncoding( 'binary' );
    res.data = '';
    res.on( 'data', chunk => {
        res.data += chunk;
    });
    res.on( 'end', () => {
        callback( null, new Buffer( res.data, 'binary' ));
    });
}

describe( 'action', function() {
    before( function( done ) {
        // mock the datastore module
        const dataStore = {
            read: ( resourceId ) => {
                switch ( resourceId ) {
                    case '8d461483-e701-47ca-8788-c6210550fdb9': return Promise.resolve({
                        name: 'animations',
                        parent: null,
                    });
                    case '4d2df4ed-2d77-4bc2-ba94-1d999786aa1e': return Promise.resolve( 'http://localhost:3000/media/animations/fireball.gif' );
                    case '614dd78b-0d7b-4777-8aa6-c9d20dfb3032': return Promise.resolve( 'http://localhost:3000/media/animations/player.gif' );
                    case '0dfa3088-2ab8-4a52-9c9f-3fa87c1f4ccb': return Promise.resolve({
                        name: 'spritemaps',
                        parent: null,
                    });
                    case '8eb7c191-21a9-4f4a-bf50-9fb01006f549': return Promise.resolve( 'http://localhost:3000/media/spritemaps/powerup.png' );
                    default: return Promise.reject();
                }
            },
            alias: ( resourceId ) => {
                switch ( resourceId ) {
                    case 'animations':
                        return Promise.resolve({
                            data: {
                                GUID: '8d461483-e701-47ca-8788-c6210550fdb9',
                            },
                        });
                    case 'animations/fireball.gif': return Promise.resolve({
                        data: {
                            GUID: '4d2df4ed-2d77-4bc2-ba94-1d999786aa1e',
                        },
                    });
                    default: return Promise.reject();
                }
            },
            // TODO
            search: () => {},
            inspect: ( resourceId, fields ) => {
                switch ( resourceId ) {
                    case '614dd78b-0d7b-4777-8aa6-c9d20dfb3032':
                        const source = {
                            type: 'file',
                            size: 1234567890,
                            name: 'player.gif',
                            parent: '8d461483-e701-47ca-8788-c6210550fdb9',
                            dateCreated: 1439765335,
                            lastModified: 1439765353,
                        };
                        if ( !fields ) return Promise.resolve({ data: source });
                        const data = {};
                        for ( const field in source ) {
                            if ( fields.indexOf( field ) === -1 ) continue;
                            data[field] = source[field];
                        }
                        return Promise.resolve({ data });
                    default: return Promise.reject();
                }
            },
            download: () => {},
            create: ( resourceId, type, name, content ) => {
                switch ( resourceId ) {
                    case '0dfa3088-2ab8-4a52-9c9f-3fa87c1f4ccb':
                        return new Promise(( resolve, reject ) => {
                            content.pipe( fs.createWriteStream( `./test/testfiles/media/spritemaps/${name}` ));
                            content.on( 'error', reject );
                            content.on( 'end', () => resolve({ data: 'efc2cd1d-91d2-4cfe-839e-0ed9a1a04ad6' }));
                        });
                    default: return Promise.reject();
                }
            },
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
        let buffer;

        before( function() {
            return fs.readFileAsync( './test/testfiles/media/animations/fireball.gif', null )
            .then( res => {
                buffer = res;
            });
        });

        it( 'should return animations/fireball', function( done ) {
            supertest( app )
            .get( '/4d2df4ed-2d77-4bc2-ba94-1d999786aa1e' )
            .set( 'Accept', 'image/gif' )
            .expect( 'Content-Type', /image\/gif/g )
            .parse( binaryParser )
            .expect( res =>
                expect( !buffertools.compare( res.body, buffer )).to.be.true
            )
            .expect( 200, done );
        });
    });

    describe( 'read', function() {
        let buffer;

        before( function() {
            return fs.readFileAsync( './test/testfiles/media/animations/player.gif', null )
            .then( res => {
                buffer = res;
            });
        });

        it( 'should return animations/player.gif', function( done ) {
            supertest( app )
            .get( '/614dd78b-0d7b-4777-8aa6-c9d20dfb3032' )
            .query({ action: 'read' })
            .set( 'Accept', 'image/gif' )
            .expect( 'Content-Type', /image\/gif/g )
            .parse( binaryParser )
            .expect( res =>
                expect( !buffertools.compare( res.body, buffer )).to.be.true
            )
            .expect( 200, done );
        });
    });

    describe.skip( 'search', function() {
        // TODO: finish designing this out
    });

    // fails due to https://github.com/Brinkbit/http-fs-node/issues/18
    describe( 'alias', function() {
        it( 'should return guid data object', function( done ) {
            supertest( app )
            .get( '/animations/' )
            .query({ action: 'alias' })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({ GUID: '8d461483-e701-47ca-8788-c6210550fdb9' })
            )
            .expect( 200, done );
        });
    });

    describe( 'inspect', function() {
        it( 'should return all metadata of the resource', function( done ) {
            supertest( app )
            .get( '/614dd78b-0d7b-4777-8aa6-c9d20dfb3032' )
            .query({ action: 'inspect' })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    type: 'file',
                    size: 1234567890,
                    name: 'player.gif',
                    parent: '8d461483-e701-47ca-8788-c6210550fdb9',
                    dateCreated: 1439765335,
                    lastModified: 1439765353,
                })
            )
            .expect( 200, done );
        });

        it( 'should return selected metadata of the resource', function( done ) {
            supertest( app )
            .get( '/614dd78b-0d7b-4777-8aa6-c9d20dfb3032' )
            .query({
                action: 'inspect',
                parameters: {
                    fields: [ 'type', 'name' ],
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    type: 'file',
                    name: 'player.gif',
                })
            )
            .expect( 200, done );
        });
    });

    describe.skip( 'download', function() {
        // TODO
    });

    describe( 'post', function() {
        after( function() {
            fs.removeAsync( './test/testfiles/media/spritemaps/explosion.png' );
        });

        it( 'should upload a new file', function() {
            const uploadPath = './test/testfiles/media/spritemaps/explosion.png';
            return expect( fs.accessAsync( uploadPath, fs.R_OK )).to.be.rejected
            .then(() => new Promise(( resolve, reject ) => {
                request.post({
                    url: 'http://localhost:3000/0dfa3088-2ab8-4a52-9c9f-3fa87c1f4ccb',
                    formData: {
                        // Pass data via Streams
                        content: fs.createReadStream( `${__dirname}/testfiles/explosion.png` ),
                    },
                }, function callback( err, httpResponse ) {
                    if ( err ) reject( err );
                    else resolve( httpResponse );
                });
            }))
            .then( res => {
                expect( res.statusCode ).to.equal( 200 );
                return expect( fs.accessAsync( uploadPath, fs.R_OK )).to.be.fulfilled;
            });
        });
    });

    describe( 'put', function() {});
    describe( 'delete', function() {});
});
