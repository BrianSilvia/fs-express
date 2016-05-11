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
const permissions = require( 'fs-brinkbit-permissions' );
const mongoose = require( 'mongoose' );
const mongoConfig = require( 'the-brink-mongodb' );

const File = require( './schemas/fileSchema.js' );
const Permission = require( './schemas/permissionSchema.js' );

const conn = mongoose.connection;
mongoose.Promise = Promise;

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

function connect() {
    return new Promise(( resolve, reject ) => {
        if ( conn.readyState === 1 ) {
            // we're already connected
            return resolve();
        }

        mongoose.connect( mongoConfig.mongodb.uri );
        conn.on( 'error', reject );
        conn.on( 'open', resolve );
    });
}

describe( 'action', function() {
    before( function( done ) {
        const fsExpress = require( '../index.js' );

        app.use( express.static( __dirname + '/testfiles' ));

        app.use(( req, res, next ) => {
            req.userId = 'userId';
            next();
        });

        // Connect to mongo and seed the db
        connect()
        .then( function() {
            const file1 = new File({
                '_id': '4d2df4ed-2d77-4bc2-ba94-1d999786aa1e',
                'mimeType': 'image/gif',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['12345'],
                'name': 'fireball.gif',
            });
            file1.save();

            const file2 = new File({
                '_id': '614dd78b-0d7b-4777-8aa6-c9d20dfb3032',
                'mimeType': 'image/gif',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['12345'],
                'name': 'player.gif',
            });
            file2.save();

            const permission2 = new Permission({
                resourceType: 'file',
                resourceId: '614dd78b-0d7b-4777-8aa6-c9d20dfb3032',
                userId: 'userId',
                read: true,
                write: true,
                destroy: true,
            });
            permission2.save();


            // Returns the dataStore object, after the mongoose connection is made
            require( 'fs-s3-mongo' )({
                s3: {
                    bucket: process.env.AWS_TEST_BUCKET,
                    region: process.env.AWS_TEST_REGION,
                },
            })
            .then( dataStore => {
                app.use( fsExpress({ dataStore, permissions }));

                // serve up actual static content to query for
                app.server = http.createServer( app );
                app.server.listen( 3000, done );
            });
        });
    });

    after( function() {
        app.server.close();
        File.remove({}).exec();
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
