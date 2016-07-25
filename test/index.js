'use strict';

process.env.NODE_ENV = 'debug';

const express = require( 'express' );
const chai = require( 'chai' );
const expect = chai.expect;
const chaiaspromised = require( 'chai-as-promised' );
const supertest = require( 'supertest' );
const request = require( 'request' );
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

const ROOT_FOLDER = 'root';
const EXPLOSION_PNG = 'f283fba9-8b10-454c-b656-ee93c068da26';
const PLAYER_PNG = '4b82b9df-d461-485c-9e6a-bdf5f94ae717';
const ANIMATIONS_FOLDER = '8d461483-e701-47ca-8788-c6210550fdb9';
const FIREBALL_GIF = '4d2df4ed-2d77-4bc2-ba94-1d999786aa1e';
const PLAYER_GIF = '614dd78b-0d7b-4777-8aa6-c9d20dfb3032';
const SPRITEMAPS_FOLDER = 'f3d9a45f-6972-4a21-8a4b-073de06b6a4b';
const POWERUP_PNG = '0dfa3088-2ab8-4a52-9c9f-3fa87c1f4ccb';

/* Test directory structure
    / (root)
        explosion.png
        player.png
        animations/
            fireball.gif
            player.gif
        spritemaps/
            powerup.png
*/

let app;
let rootExplosionFile;
let rootPlayerFile;
let animationsFolder;
let fireballFile;
let playerFile;
let spritemapsFolder;
let powerupFile;

let rootExplosionFileObj;
let rootPlayerFileObj;
let animationsFolderObj;
let fireballFileObj;
let playerFileObj;
let spritemapsFolderObj;
let powerupFileObj;

describe( 'action', function() {
    before( function( done ) {
        app = require( '../src/index.js' );
        db.connect()
        .then(() => app.start())
        .then(() => {
            app.use( express.static( __dirname + '/testfiles' ));

            app.use(( req, res, next ) => {
                req.userId = 'userId';
                next();
            });

            db.connect()
            .then( function() {
                const rootFileObj = {
                    '_id': ROOT_FOLDER,
                    'mimeType': 'folder',
                    'size': 999,
                    'dateCreated': 1462329089,
                    'lastModified': 1462329089,
                    'parents': [],
                    'name': '/',
                };
                const rootFile = new File( rootFileObj );
                rootFile.save();

                rootExplosionFileObj = {
                    '_id': EXPLOSION_PNG,
                    'mimeType': 'image/png',
                    'size': 999,
                    'dateCreated': 1462329089,
                    'lastModified': 1462329089,
                    'parents': [ROOT_FOLDER],
                    'name': 'explosion.png',
                };
                rootExplosionFile = new File( rootExplosionFileObj );
                rootExplosionFile.save();

                rootPlayerFileObj = {
                    '_id': PLAYER_PNG,
                    'mimeType': 'image/png',
                    'size': 999,
                    'dateCreated': 1462329089,
                    'lastModified': 1462329089,
                    'parents': [ROOT_FOLDER],
                    'name': 'player.png',
                };
                rootPlayerFile = new File( rootPlayerFileObj );
                rootPlayerFile.save();

                animationsFolderObj = {
                    '_id': ANIMATIONS_FOLDER,
                    'mimeType': 'folder',
                    'size': 999,
                    'dateCreated': 1462329089,
                    'lastModified': 1462329089,
                    'parents': [ROOT_FOLDER],
                    'name': 'animations',
                };
                animationsFolder = new File( animationsFolderObj );
                animationsFolder.save();

                fireballFileObj = {
                    '_id': FIREBALL_GIF,
                    'mimeType': 'image/gif',
                    'size': 999,
                    'dateCreated': 1462329089,
                    'lastModified': 1462329089,
                    'parents': [ANIMATIONS_FOLDER],
                    'name': 'fireball.gif',
                };
                fireballFile = new File( fireballFileObj );
                fireballFile.save();

                playerFileObj = {
                    '_id': PLAYER_GIF,
                    'mimeType': 'image/gif',
                    'size': 999,
                    'dateCreated': 1466368197000,
                    'lastModified': 1466368197000,
                    'parents': [ANIMATIONS_FOLDER],
                    'name': 'player.gif',
                };
                playerFile = new File( playerFileObj );
                playerFile.save();

                spritemapsFolderObj = {
                    '_id': SPRITEMAPS_FOLDER,
                    'mimeType': 'folder',
                    'size': 999,
                    'dateCreated': 1462329089,
                    'lastModified': 1462329089,
                    'parents': [ROOT_FOLDER],
                    'name': 'spritemaps',
                };
                spritemapsFolder = new File( spritemapsFolderObj );
                spritemapsFolder.save();

                powerupFileObj = {
                    '_id': POWERUP_PNG,
                    'mimeType': 'image/png',
                    'size': 999,
                    'dateCreated': 1462329089,
                    'lastModified': 1462329089,
                    'parents': [SPRITEMAPS_FOLDER],
                    'name': 'powerup.png',
                };
                powerupFile = new File( powerupFileObj );
                powerupFile.save();

                // const permission2 = new Permission({
                //     resourceType: 'file',
                //     resourceId: PLAYER_GIF,
                //     userId: 'userId',
                //     read: true,
                //     write: true,
                //     destroy: true,
                // });
                // permission2.save();
            });

            done();
        });
    });

    after( function() {
        app.server.close();
        File.remove({}).exec();
    });

    describe( 'misc', function() {
        it( 'should reject with a 404/resource not found error, with an empty path', ( done ) => {
            supertest( app )
            .get( '/' )
            .set( 'Accept', 'application/vnd.api+json' )
            // .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 404,
                    message: 'Resource does not exist.',
                })
            )
            .expect( 404, done );
        });

        it( 'should reject with a 404/resource not found error, with an invalid path', ( done ) => {
            supertest( app )
            .get( '/invalid_guid' )
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 404,
                    message: 'Resource does not exist.',
                })
            )
            .expect( 404, done );
        });

        it( 'should reject with a 501/invalid action object when given an invalid action', ( done ) => {
            supertest( app )
            .get( '/' )
            .query({
                action: 'wrongAction',
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 501,
                    message: 'Invalid action.',
                })
            )
            .expect( 501, done );
        });

        it( 'should reject with 501/invalid parameters when given a malformed parameter object', ( done ) => {
            supertest( app )
            .get( '/animations/' )
            .query({
                action: 'alias',
                parameters: {
                    noRootId: 'notAnId',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 501,
                    message: 'Invalid parameters.',
                })
            )
            .expect( 501, done );
        });
    });

    describe( 'get', function() {
        let buffer;

        before( function() {
            return fs.readFileAsync( './test/testfiles/media/animations/fireball.gif', null )
            .then( res => {
                buffer = res;
            });
        });

        it( 'should return animations/fireball', ( done ) => {
            supertest( app )
            .get( `/${FIREBALL_GIF}` )
            .set( 'Accept', 'image/gif' )
            .expect( 'Content-Type', /image\/gif/g )
            .parse( binaryParser )
            .expect( res =>
                expect( !buffertools.compare( res.body, buffer )).to.be.true
            )
            .expect( 200, done );
        });
    });

    describe.only( 'read', function() {
        let buffer;

        before( function() {
            return fs.readFileAsync( './test/testfiles/media/animations/player.gif', null )
            .then( res => {
                buffer = res;
            });
        });

        it( 'should return animations/player.gif', ( done ) => {
            supertest( app )
            .get( `/${PLAYER_GIF}` )
            .query({ action: 'read' })
            .set( 'Accept', 'image/gif' )
            .expect( 'Content-Type', /image\/gif/g )
            .parse( binaryParser )
            .expect( res =>
                expect( !buffertools.compare( res.body, buffer )).to.be.true
            )
            .expect( 200, done );
        });

        it( 'should return a list of child resources for a folder', ( done ) => {
            supertest( app )
            .get( `/${ANIMATIONS_FOLDER}` )
            .query({ action: 'read' })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal([ FIREBALL_GIF, PLAYER_GIF ])
            )
            .expect( 200, done );
        });

        it( 'should return everything', ( done ) => {
            supertest( app )
            .get( `/${ROOT_FOLDER}` )
            .query({
                action: 'read',
                parameters: {
                    flags: 'r',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res => {
                rootExplosionFileObj.__v = 0;
                rootExplosionFileObj.dateCreated = JSON.stringify( rootExplosionFile._doc.dateCreated ).replace( /\"/g, '' );
                rootExplosionFileObj.lastModified = JSON.stringify( rootExplosionFile._doc.lastModified ).replace( /\"/g, '' );

                rootPlayerFileObj.__v = 0;
                rootPlayerFileObj.dateCreated = JSON.stringify( rootPlayerFile._doc.dateCreated ).replace( /\"/g, '' );
                rootPlayerFileObj.lastModified = JSON.stringify( rootPlayerFile._doc.lastModified ).replace( /\"/g, '' );

                animationsFolderObj.__v = 0;
                animationsFolderObj.dateCreated = JSON.stringify( animationsFolder._doc.dateCreated ).replace( /\"/g, '' );
                animationsFolderObj.lastModified = JSON.stringify( animationsFolder._doc.lastModified ).replace( /\"/g, '' );

                fireballFileObj.__v = 0;
                fireballFileObj.dateCreated = JSON.stringify( fireballFile._doc.dateCreated ).replace( /\"/g, '' );
                fireballFileObj.lastModified = JSON.stringify( fireballFile._doc.lastModified ).replace( /\"/g, '' );

                playerFileObj.__v = 0;
                playerFileObj.dateCreated = JSON.stringify( playerFile._doc.dateCreated ).replace( /\"/g, '' );
                playerFileObj.lastModified = JSON.stringify( playerFile._doc.lastModified ).replace( /\"/g, '' );

                spritemapsFolderObj.__v = 0;
                spritemapsFolderObj.dateCreated = JSON.stringify( spritemapsFolder._doc.dateCreated ).replace( /\"/g, '' );
                spritemapsFolderObj.lastModified = JSON.stringify( spritemapsFolder._doc.lastModified ).replace( /\"/g, '' );

                powerupFileObj.__v = 0;
                powerupFileObj.dateCreated = JSON.stringify( powerupFile._doc.dateCreated ).replace( /\"/g, '' );
                powerupFileObj.lastModified = JSON.stringify( powerupFile._doc.lastModified ).replace( /\"/g, '' );

                return expect( res.body ).to.deep.equal([
                    rootExplosionFileObj,
                    rootPlayerFileObj,
                    animationsFolderObj,
                    fireballFileObj,
                    playerFileObj,
                    spritemapsFolderObj,
                    powerupFileObj,
                ]);
            })
            .expect( 200, done );
        });
    });

    describe( 'search', function() {
        it( 'should return all files that match the search criteria in that folder with a 200 status', ( done ) => {
            supertest( app )
            .get( `/${ANIMATIONS_FOLDER}` )
            .query({
                action: 'search',
                parameters: {
                    query: { mimeType: 'image/gif' },
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res => {
                expect( res.body ).to.have.property( '_id', PLAYER_GIF );
                expect( res.body ).to.have.property( 'dateCreated', '2016-06-19T20:29:57.000Z' );
                expect( res.body ).to.have.property( 'lastModified', '2016-06-19T20:29:57.000Z' );
                expect( res.body ).to.have.property( 'mimeType', 'image/gif' );
                // expect( res.body ).to.have.property( 'parents', [ ANIMATIONS_FOLDER ]);
            })
            .expect( 200, done );
        });

        it( 'should return an empty array if nothing matches', ( done ) => {
            supertest( app )
            .get( `/${ANIMATIONS_FOLDER}` )
            .query({
                action: 'search',
                parameters: {
                    query: { mimeType: 'notAMimeType' },
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res => {
                expect( res.body ).to.deep.equal([]);
            })
            .expect( 200, done );
        });
    });

    // fails due to https://github.com/Brinkbit/http-fs-node/issues/18
    describe( 'alias', function() {
        it( 'should return guid data object', ( done ) => {
            supertest( app )
            .get( '/animations/' )
            .query({
                action: 'alias',
                parameters: {
                    rootId: ROOT_FOLDER,
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({ GUID: ANIMATIONS_FOLDER })
            )
            .expect( 200, done );
        });
    });

    describe( 'inspect', function() {
        it( 'should return all metadata of the resource', ( done ) => {
            supertest( app )
            .get( `/${PLAYER_GIF}` )
            .query({ action: 'inspect' })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res => {
                expect( res.body ).to.have.property( '_id', PLAYER_GIF );
                expect( res.body ).to.have.property( 'dateCreated', '2016-06-19T20:29:57.000Z' );
                expect( res.body ).to.have.property( 'lastModified', '2016-06-19T20:29:57.000Z' );
                expect( res.body ).to.have.property( 'mimeType', 'image/gif' );
                // expect( res.body ).to.have.property( 'parents', [ ANIMATIONS_FOLDER ]);
            })
            .expect( 200, done );
        });

        it( 'should return selected metadata of the resource', ( done ) => {
            supertest( app )
            .get( `/${PLAYER_GIF}` )
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

    describe( 'download', function() {
        it( 'should return a zipped copy of the resource', function() {});
    });

    describe( 'rename', function() {
        it( 'should return a 409/already exists error if a resource in that folder has that name already', ( done ) => {
            supertest( app )
            .put( `/${PLAYER_GIF}` )
            .query({
                action: 'rename',
                parameters: {
                    name: 'explosion.png',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 409,
                    message: 'Resource already exists.',
                })
            )
            .expect( 409, done );
        });

        it( 'should return a 200 status after it renames properly', ( done ) => {
            supertest( app )
            .put( `/${PLAYER_GIF}` )
            .query({
                action: 'rename',
                parameters: {
                    name: 'player_2.gif',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.statusCode ).to.equal( 200 )
            )
            .expect( 200, done );
        });
    });

    describe( 'copy', ( done ) => {
        it( 'should return a 409/already exists error if a resource in the destination folder has that name already', function() {
            supertest( app )
            .post( `${FIREBALL_GIF}` )
            .query({
                action: 'copy',
                parameters: {
                    destination: ANIMATIONS_FOLDER,
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 409,
                    message: 'Resource already exists.',
                })
            )
            .expect( 409, done );
        });

        it( 'should return a 404/not found error if the destination folder doesnt exist', function() {
            supertest( app )
            .post( `/${FIREBALL_GIF}` )
            .query({
                action: 'copy',
                parameters: {
                    destination: 'doesNotExist',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 404,
                    message: 'Resource does not exist.',
                })
            )
            .expect( 404, done );
        });

        it( 'should make a copy of the resource in the destination folder and return a 200 status', function() {
            supertest( app )
            .post( `/${FIREBALL_GIF}` )
            .query({
                action: 'copy',
                parameters: {
                    destination: SPRITEMAPS_FOLDER,
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res => res.statusCode ).to.equal( 200 )
            .expect( 200, done );
        });
    });

    describe( 'move', function() {
        it( 'should return a 409/already exists error if a resource in the destination folder has that name already', ( done ) => {
            supertest( app )
            .put( `/${FIREBALL_GIF}` )
            .query({
                action: 'move',
                parameters: {
                    destination: ANIMATIONS_FOLDER,
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 409,
                    message: 'Resource already exists.',
                })
            )
            .expect( 409, done );
        });

        it( 'should return a 404/not found error if the destination folder doesnt exist', ( done ) => {
            supertest( app )
            .put( `/${FIREBALL_GIF}` )
            .query({
                action: 'move',
                parameters: {
                    destination: 'doesNotExist',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 404,
                    message: 'Resource does not exist.',
                })
            )
            .expect( 404, done );
        });

        it( 'should move the resource to the destination folder and return a 200 status', ( done ) => {
            supertest( app )
            .put( `/${FIREBALL_GIF}` )
            .query({
                action: 'move',
                parameters: {
                    destination: SPRITEMAPS_FOLDER,
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res => res.statusCode ).to.equal( 200 )
            .expect( 200, done );
        });
    });

    let testingGUID;
    describe( 'post', function() {
        it( 'should return a 409/already exists error if a resource in the destination folder has that name already', ( done ) => {
            supertest( app )
            .post( `/${SPRITEMAPS_FOLDER}` )
            .query({
                action: 'create',
                parameters: {
                    name: 'powerup.png',
                    mimeType: 'image/png',
                    content: 'non-empty',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 409,
                    message: 'Resource already exists.',
                })
            )
            .expect( 409, done );
        });

        it( 'should return a 404/not found error if the destination folder doesnt exist', ( done ) => {
            supertest( app )
            .post( '/doesNotExist' )
            .query({
                action: 'create',
                parameters: {
                    name: 'powerup.png',
                    mimeType: 'image/png',
                    content: 'non-empty',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 404,
                    message: 'Resource does not exist.',
                })
            )
            .expect( 404, done );
        });

        it( 'should upload a new file and return a 200 status', () => {
            return new Promise(( resolve, reject ) => {
                request.post({
                    url: `http://localhost:${process.env.APP_PORT}/${SPRITEMAPS_FOLDER}`,
                    formData: {
                        // Pass data via Streams
                        content: fs.createReadStream( `${__dirname}/testfiles/explosion.png` ),
                        name: 'explosion.png',
                        type: 'image/png',
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
                testingGUID = response[0]._id;
            });
        });

        it( 'should create a folder', ( done ) => {
            supertest( app )
            .post( `/${SPRITEMAPS_FOLDER}` )
            .query({
                action: 'create',
                parameters: {
                    name: 'newFolder',
                    mimeType: 'folder',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.statusCode ).to.equal( 200 ))
            .expect( 200, done );
        });
    });

    describe( 'bulk', function() {});

    describe( 'put', function() {
        it( 'should return a 404/not found when the resource doesnt exist', ( done ) => {
            supertest( app )
            .put( '/doesNotExist' )
            .query({
                action: 'update',
                parameters: {
                    content: 'non-empty',
                },
            })
            .set( 'Accept', 'application/vnd.api+json' )
            .expect( 'Content-Type', /application\/vnd\.api\+json/gi )
            .expect( res =>
                expect( res.body ).to.deep.equal({
                    status: 404,
                    message: 'Resource does not exist.',
                })
            )
            .expect( 404, done );
        });

        it( 'should update both the s3 and the mongodb document', () => {
            return new Promise(( resolve, reject ) => {
                request.post({
                    url: `http://localhost:${process.env.APP_PORT}/${testingGUID}`,
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

        it( 'should delete the folder and all subchildren recursively', function() {});
    });
});
