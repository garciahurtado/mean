'use strict';

/**
 * Module dependencies.
 */
var express = require('express');
var config = require('./config');
var handlebars = require('express3-handlebars');
var appPath = process.cwd();
var fs = require('fs');

module.exports = function(app) {
    app.set('showStackError', true);

    // Prettify HTML
    app.locals.pretty = true;

    // cache=memory or swig dies in NODE_ENV=production
    app.locals.cache = 'memory';

    // Should be placed before express.static
    // To ensure that all assets and data are compressed (utilize bandwidth)
    app.use(express.compress({
        filter: function(req, res) {
            return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
        },
        // Levels are specified in a range of 0 to 9, where-as 0 is
        // no compression and 9 is best compression, but slowest
        level: 9
    }));

    // Only use logger for development environment
    if (process.env.NODE_ENV === 'development') {
        app.use(express.logger('dev'));
    }

    // Set views path
    app.set('views', config.root + '/server/views');

    // assign the template engine to .html files
    var hbConfig = {
        extname: '.html',
        layoutsDir: 'server/views/layouts',
        partialsDir: 'server/views/includes'
    };
    app.engine('html', handlebars.create(hbConfig).engine);
    app.set('view engine', 'html');
    app.locals.layout = 'default.html';


    // Enable jsonp
    app.enable('jsonp callback');

    app.configure(function() {
        // The cookieParser should be above session
        app.use(express.cookieParser());

        // Request body parsing middleware should be above methodOverride
        app.use(express.urlencoded());
        app.use(express.json());
        app.use(express.methodOverride());

        // Routes should be at the last
        app.use(app.router);

        // Setting the fav icon and static folder
        app.use(express.favicon());
        app.use('/public', express.static(config.root + '/public'));

        bootstrapRoutes();

        // Assume "not found" in the error msgs is a 404. this is somewhat
        // silly, but valid, you can do whatever you like, set properties,
        // use instanceof etc.
        app.use(function(err, req, res, next) {
            // Treat as 404
            if (~err.message.indexOf('not found')) return next();

            // Log it
            console.error(err.stack);

            // Error page
            res.status(500).render('500', {
                error: err.stack
            });
        });

        // Assume 404 since no middleware responded
        app.use(function(req, res) {
            res.status(404).render('404', {
                url: req.originalUrl,
                error: 'Not found'
            });
        });
    });

    /**
     * Autoload all routes under '/server/routes'
     */
    function bootstrapRoutes() {
        var routes_path = appPath + '/server/routes';
        var walk = function(path) {
            fs.readdirSync(path).forEach(function(file) {
                var newPath = path + '/' + file;
                var stat = fs.statSync(newPath);
                if (stat.isFile()) {
                    if (/(.*)\.(js$|coffee$)/.test(file)) {
                        require(newPath)(app);
                    }
                    // We skip the app/routes/middlewares directory as it is meant to be
                    // used and shared by routes as further middlewares and is not a
                    // route by itself
                } else if (stat.isDirectory() && file !== 'middlewares') {
                    walk(newPath);
                }
            });
        };
        walk(routes_path);
    }
};