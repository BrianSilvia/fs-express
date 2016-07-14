'use strict';

const express = require( 'express' );
const router = express.Router(); // eslint-disable-line new-cap
const request = require( 'request' );
const Busboy = require( 'busboy' );
const R = require( 'ramda' );
const logger = require( 'brinkbit-logger' )({ __filename });
const mongoose = require( 'mongoose' );
let fs = require( 'http-fs-node' );
const http = require( 'http' );

const standardMethod = R.curry(( method, req, res, data ) => {
    logger.info( `Calling with params -- resource: '${req.params.resource}', userId: '${req.userId}', data: '${JSON.stringify( data )}'` );
    return fs[method]( req.params.resource, req.userId, data );
});

const handlePost = R.curry(( limits, req, res, data ) => {
    if ( !data ) {
        return new Promise(( resolve, reject ) => {
            logger.info( 'Initializing busyboy to handle POST request' );
            const busboy = new Busboy({ headers: req.headers, limits });
            const promises = [];
            busboy.on( 'file', ( fieldname, content, name, encoding, type ) => {
                logger.info( `Resource: ${req.params.resource}, user: ${req.userId}, name: ${name}, type: ${type}` );
                promises.push(
                    fs.POST( // eslint-disable-line new-cap
                        req.params.resource,
                        req.userId,
                        { parameters: { name, type, content } }
                    )
                );
            });
            busboy.on( 'finish', () =>
                Promise.all( promises )
                .then( resolve )
                .catch( reject )
            );
            req.pipe( busboy );
        });
    }

    logger.warning( 'Data passed in -- ignoring for now' );
});

const app = express();

app.start = () => {
    return require( 'fs-s3-mongo' )({
        s3: {
            bucket: process.env.AWS_TEST_BUCKET,
            region: process.env.AWS_TEST_REGION,
        },
        mongo: mongoose.connection,
    })
    .then( dataStore => {
        const permissions = require( 'fs-brinkbit-permissions' );
        app.use( module.exports.init({ dataStore, permissions }));

        // serve up actual static content to query for
        app.server = http.createServer( app );
        app.server.listen( process.env.APP_PORT || 3000 );
        return app;
    });
};

app.init = config => {
    logger.info( `Initing module with config: ${config}` );
    fs = fs( config );

    const methods = {
        GET: standardMethod( 'GET' ),
        POST: handlePost( config.limits || {}),
        PUT: standardMethod( 'PUT' ),
        DELETE: standardMethod( 'DELETE' ),
    };

    router.use( '/:resource', ( req, res ) => {
        const query = req.method === 'GET' ? req.query : req.body;
        logger.info( `Handing ${req.method} request` );
        methods[req.method]( req, res, query )
        .then( data => {
            logger.info( `Handling top level response back to client: '${JSON.stringify( data )}'` );

            // Tests data to see if it's an array (GET on a folder)
            if ( req.method === 'GET' && R.type( data ) !== 'Array' && ( !query.action || query.action === 'read' )) {
                logger.info( `Sending '${data}' back to client` );
                request.get( data ).pipe( res );
            }
            else {
                logger.info( `Sending ${JSON.stringify( data )} back to the client` );
                res.set( 'Content-Type', 'application/vnd.api+json' );
                res.send( data );
            }
        })
        .catch( data => {
            logger.error( `Error caught at top level: ${data.status}, ${data.message}` );
            res.status( data.status )
            .send( data.message );
        });
    });
    return router;
};

module.exports = exports = app;
