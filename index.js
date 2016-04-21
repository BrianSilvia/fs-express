'use strict';

const express = require( 'express' );
const router = express.Router(); // eslint-disable-line new-cap
const request = require( 'request' );
const Busboy = require( 'busboy' );
const R = require( 'ramda' );
let fs = require( 'http-fs-node' );

const standardMethod = R.curry(( method, req, res, data ) => {
    return fs[method]( req.params.resource, req.userId, data );
});

const handlePost = R.curry(( limits, req, res, data ) => {
    if ( !data ) {
        return new Promise(( resolve, reject ) => {
            const busboy = new Busboy({ headers: req.headers, limits });
            const promises = [];
            busboy.on( 'file', ( fieldname, content, name, encoding, type ) => {
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
});

module.exports = config => {
    fs = fs( config );

    const methods = {
        GET: standardMethod( 'GET' ),
        POST: handlePost( config.limits || {}),
        PUT: standardMethod( 'PUT' ),
        DELETE: standardMethod( 'DELETE' ),
    };

    router.use( '/:resource', ( req, res ) => {
        const query = req.method === 'GET' ? req.query : req.body;
        methods[req.method]( req, res, query )
        .then( data => {
            if ( req.method === 'GET' && ( !query.action || query.action === 'read' )) {
                request.get( data ).pipe( res );
            }
            else {
                res.set( 'Content-Type', 'application/vnd.api+json' );
                res.send( data.data );
            }
        })
        .catch( data => {
            res.status( data.status )
            .send( data.message );
        });
    });
    return router;
};
