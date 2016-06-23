'use strict';

process.env.NODE_ENV = 'development';

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
const mongoose = require( 'mongoose' );
const conn = mongoose.connection;
const schemas = require( './schemas/fileSchema.js' )( conn );
const File = schemas.Files;
// const Permission = schemas.Permissions;
const db = require( 'brinkbit-mongodb' )( conn );

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

let playerFile;

describe( 'action', function() {
    before( function( done ) {
        const fsExpress = require( '../index.js' );

        app.use( express.static( __dirname + '/testfiles' ));

        app.use(( req, res, next ) => {
            req.userId = 'userId';
            next();
        });

        // Connect to mongo and seed the db
        db.connect()
        .then( function() {
            const rootFile = new File({
                '_id': 'root',
                'mimeType': 'folder',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': [],
                'name': '/',
            });
            rootFile.save();

            const rootExplosionFile = new File({
                '_id': 'f283fba9-8b10-454c-b656-ee93c068da26',
                'mimeType': 'image/png',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['root'],
                'name': 'explosion.png',
            });
            rootExplosionFile.save();

            // TESTS delete
            // const rootExplosionFile2 = new File({
            //     '_id': 'e8434881-1f01-49a0-b6ca-6f25c8893e4e',
            //     'mimeType': 'image/png',
            //     'size': 999,
            //     'dateCreated': 1462329089,
            //     'lastModified': 1462329089,
            //     'parents': ['f3d9a45f-6972-4a21-8a4b-073de06b6a4b'],
            //     'name': 'explosion.png',
            // });
            // rootExplosionFile2.save();

            const rootPlayerFile = new File({
                '_id': '4b82b9df-d461-485c-9e6a-bdf5f94ae717',
                'mimeType': 'image/png',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['root'],
                'name': 'player.png',
            });
            rootPlayerFile.save();

            const animationsFolder = new File({
                '_id': '8d461483-e701-47ca-8788-c6210550fdb9',
                'mimeType': 'folder',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['root'],
                'name': 'animations',
            });
            animationsFolder.save();

            const fireballFile = new File({
                '_id': '4d2df4ed-2d77-4bc2-ba94-1d999786aa1e',
                'mimeType': 'image/gif',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['8d461483-e701-47ca-8788-c6210550fdb9'],
                'name': 'fireball.gif',
            });
            fireballFile.save();

            playerFile = {
                '_id': '614dd78b-0d7b-4777-8aa6-c9d20dfb3032',
                'mimeType': 'image/gif',
                'size': 999,
                'dateCreated': 1466368197000,
                'lastModified': 1466368197000,
                'parents': ['8d461483-e701-47ca-8788-c6210550fdb9'],
                'name': 'player.gif',
            };
            const playerFileObj = new File( playerFile );
            playerFileObj.save();

            const spritemapsFolder = new File({
                '_id': 'f3d9a45f-6972-4a21-8a4b-073de06b6a4b',
                'mimeType': 'folder',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['root'],
                'name': 'spritemaps',
            });
            spritemapsFolder.save();

            const powerupFile = new File({
                '_id': '0dfa3088-2ab8-4a52-9c9f-3fa87c1f4ccb',
                'mimeType': 'image/png',
                'size': 999,
                'dateCreated': 1462329089,
                'lastModified': 1462329089,
                'parents': ['f3d9a45f-6972-4a21-8a4b-073de06b6a4b'],
                'name': 'powerup.png',
            });
            powerupFile.save();

            // const permission2 = new Permission({
            //     resourceType: 'file',
            //     resourceId: '614dd78b-0d7b-4777-8aa6-c9d20dfb3032',
            //     userId: 'userId',
            //     read: true,
            //     write: true,
            //     destroy: true,
            // });
            // permission2.save();


            // Returns the dataStore object, after the mongoose connection is made
            let dataStore;
            require( 'fs-s3-mongo' )({
                s3: {
                    bucket: process.env.AWS_TEST_BUCKET,
                    region: process.env.AWS_TEST_REGION,
                },
            })
            .then( ds => {
                dataStore = ds;
            })
            // .then(() => require( 'fs-brinkbit-permissions' )())
            // .then( permissions => {
            .then(() => {
                const permissions = require( 'fs-brinkbit-permissions' );
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

        it( 'should return a list of child resources', function( done ) {
            supertest( app )
            .get( '/8d461483-e701-47ca-8788-c6210550fdb9' )
            .query({ action: 'read' })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal([ '4d2df4ed-2d77-4bc2-ba94-1d999786aa1e', '614dd78b-0d7b-4777-8aa6-c9d20dfb3032' ])
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
            .query({
                action: 'alias',
                parameters: {
                    rootId: 'root',
                },
            })
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
            .expect( res => {
                expect( res.body ).to.have.property( '_id', '614dd78b-0d7b-4777-8aa6-c9d20dfb3032' );
                expect( res.body ).to.have.property( 'dateCreated', '2016-06-19T20:29:57.000Z' );
                expect( res.body ).to.have.property( 'lastModified', '2016-06-19T20:29:57.000Z' );
                expect( res.body ).to.have.property( 'mimeType', 'image/gif' );
                // expect( res.body ).to.have.property( 'parents', [ '8d461483-e701-47ca-8788-c6210550fdb9' ]);
            })
            .expect( 200, done );
        });

        it( 'should return selected metadata of the resource', function( done ) {
            supertest( app )
            .get( '/614dd78b-0d7b-4777-8aa6-c9d20dfb3032' )
            .query({
                action: 'inspect',
                parameters: {
                    fields: [ 'mimeType', 'name' ],
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    mimeType: 'image/gif',
                    name: 'player.gif',
                })
            )
            .expect( 200, done );
        });
    });

    describe.skip( 'download', function() {
        // TODO
    });

    let testingGUID;
    describe( 'post', function() {
        it( 'should upload a new file', function() {
            return new Promise(( resolve, reject ) => {
                request.post({
                    url: 'http://localhost:3000/f3d9a45f-6972-4a21-8a4b-073de06b6a4b',
                    formData: {
                        // Pass data via Streams
                        content: fs.createReadStream( `${__dirname}/testfiles/explosion.png` ),
                    },
                }, function callback( err, httpResponse ) {
                    if ( err ) reject( err );
                    else resolve( httpResponse );
                });
            })
            .then( res => {
                const response = JSON.parse( res.body );
                expect( res.statusCode ).to.equal( 200 );
                expect( response[0]).to.have.deep.property( '_id' );
                testingGUID = response._id;
            });
        });
    });

    describe( 'put', function() {
        it( 'should update both the s3 and the mongodb document', function() {
            return new Promise(( resolve, reject ) => {
                request.post({
                    url: `http://localhost:3000/${testingGUID}`,
                    formData: {
                        // Pass data via Streams
                        content: fs.createReadStream( `${__dirname}/testfiles/player.png` ),
                    },
                }, function callback( err, httpResponse ) {
                    if ( err ) reject( err );
                    else resolve( httpResponse );
                });
            })
            .then( res =>
                expect( res.statusCode ).to.equal( 200 )
            );
        });
    });
    describe( 'delete', function() {
        it( 'should delete the s3 object and the mongodb document', function( done ) {
            supertest( app )
            .del( `/${testingGUID}` )
            .query({ action: 'destroy' })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.statusCode ).to.equal( 200 )
            )
            .expect( 200, done );
        });
    });
});
