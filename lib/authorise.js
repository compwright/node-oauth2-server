// Modules
var OAuth2Error = require('./error');

var authorise = module.exports = {};

/**
 * Authorise a request with OAuth2
 *
 * This is a the top level function that should be directly
 * passed into the express callback chain to authorise a request
 * against OAuth2
 *
 * @param  {Object}   req  Connect request
 * @param  {Object}   res  Connect response
 * @param  {Function} next Connect next
 * @return {Void}
 */
authorise.handle = function (req, res, next) {
	// Get token
	var oauth = this;
	authorise.getBearerToken(req, function (err, bearerToken) {
		if (err) return next(err);

		oauth.model.getAccessToken(bearerToken, function (err, token) {
			if (err) {
				return next(new OAuth2Error('server_error', false, err));
			}

			authorise.validateAccessToken.call(oauth, token, req, next);
		});
	});
};

/**
 * Validate Access Token
 *
 * Check access token retrieved from storage is valid
 *
 * @param  {Object}   token Connect token
 * @param  {Object}   req   Connect req
 * @param  {Function} next  Connect next
 * @return {Void}
 */
authorise.validateAccessToken = function (token, req, next) {
	if (!token) {
		return next(new OAuth2Error('invalid_grant', 'The access token provided is invalid.'));
	}

	// Check it's valid
	if (!token.expires || token.expires < this.now) {
		return next(new OAuth2Error('invalid_grant', 'The access token provided has expired.'));
	}

	// Expose params
	req.user = { id: token.user_id };

	next(); // Exit point
};

/**
 * Extract access token from request
 *
 * Checks exactly one access token had been passed and
 * does additional validation for each method of passing
 * the token.
 * Returns OAuth2 Error if any of the above conditions
 * aren't met.
 *
 * @see OAuth2Server#authorizeRequest
 *
 * @param  {Object}   req  Connect request
 * @return {Object|String}  Oauth2Error or The access token
 */
authorise.getBearerToken = function (req, next) {

	var headerToken = req.get('Authorization'),
		getToken =  req.query.access_token,
		postToken = req.body.access_token;

	// Check exactly one method was used
	var methodsUsed = (typeof headerToken !== 'undefined') + (typeof getToken !== 'undefined')
		+ (typeof postToken !== 'undefined');

	if (methodsUsed > 1) {
		return next(new OAuth2Error('invalid_request',
			'Only one method may be used to authenticate at a time (Auth header, GET or POST).'));
	} else if (methodsUsed === 0) {
		return next(new OAuth2Error('invalid_request', 'The access token was not found'));
	}

	// Header
	if (headerToken) {
		var matches = headerToken.match(/Bearer\s(\S+)/);

		if (!matches) {
			return next(new OAuth2Error('invalid_request', 'Malformed auth header'));
		}

		headerToken = matches[1];
	}

	// POST
	if (postToken) {
		if (req.method !== 'POST') {
			return next(new OAuth2Error('invalid_request',
				'When putting the token in the body, the method must be POST.'));
		}

		// Is json etc accepted in spec?
	}

	return next(null, headerToken || postToken || getToken);
};