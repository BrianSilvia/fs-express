'use strict';

const express = require( 'express' );
const router = express.Router(); // eslint-disable-line new-cap
const request = require( 'request' );
let fs = require( 'http-fs-node' );

module.exports = config => {
    fs = fs( config );
    router.use( '/:resource', ( req, res ) => {
        const query = req.method === 'GET' ? req.query : req.body;
        fs[req.method]( req.params.resource, req.userId, query )
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
