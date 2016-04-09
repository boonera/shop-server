//'use strict';

/**
 * 
 * To deploy to heroku, run:
 * $ git init
 * $ git add -A
 * $ git commit -m "update"
 * $ git push origin master
 * $ git push heroku master
 * 
 */


/**
 * Stripe keys [STEP4]
 */
var CLIENT_ID               = 'ca_77Z9VWvyFG8ScDginsfXPgQ1fgXMrtWx';            // sa.ibisevic  production ca_77Z9WqS97u4fal8OjNmMkmlYt9gaTnHs (development: ca_77Z9VWvyFG8ScDginsfXPgQ1fgXMrtWx) 
var STRIPE_API_SECRET_KEY   = 'sk_test_PjPAEVD1LXfUuA6XylJPnQX4';               // sa.ibisevic  production sk_live_0CiEBOUQbwV6vGZszWky4jGC (development: sk_test_PjPAEVD1LXfUuA6XylJPnQX4)
var FIREBASE_SECRET_KEY     = 'Kv5Fvkyo988QNIksqqpv53Y0q6JiIYbUpGj041XR'        // boonera fb   production 

var TOKEN_URI               = 'https://connect.stripe.com/oauth/token';
var AUTHORIZE_URI           = 'https://connect.stripe.com/oauth/authorize';
var FBURL                   = "https://boonera.firebaseio.com";

var qs         = require('querystring');
var request    = require('request');
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');

// payments
var stripe     = require("stripe")(STRIPE_API_SECRET_KEY);
var paypal    = require('paypal-rest-sdk');

var app         = express();
var router      = express.Router();              // get an instance of the express Router
var port        = process.env.PORT || 9311;

var Firebase    = require('firebase');
var FBREF       = new Firebase(FBURL);

// nodemailer prerequest
var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');

// http://stackoverflow.com/questions/26956251/sending-emails-using-mailgun-with-nodemailer-package
var auth = {
  auth: {
    api_key: 'key-1f0e9e270f622e52c42e408ebfae9d8d',
    domain: 'sandbox6d291dffb40847a2a9c78eb55ddf0cf6.mailgun.org'
  }
}
var nodemailerMailgun = nodemailer.createTransport(mg(auth));

// cors settings
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

app.use(allowCrossDomain);

app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});



/** 
 * =============================================================================
 * Stripe Charge
 * =============================================================================
 */
 


// when the user has not specified a destination account
router.post('/charge/nodestination', function(req, res) {
    
    console.log("--------- charge")
    console.log("charge: buyerId:", req.body.stripeBuyerId)
    console.log("charge: productId:", req.body.stripeProductId)
    
    console.log("charge/nodestination: amount:", req.body.stripeAmount)
    console.log("charge/nodestination: currency:", req.body.stripeCurrency)
    console.log("charge/nodestination: source:", req.body.stripeSource)
    console.log("charge/nodestination: description", req.body.stripeDescription)

    var charge = stripe.charges.create({
        amount:           req.body.stripeAmount,                // amount in cents, again
        currency:         req.body.stripeCurrency,
        source:           req.body.stripeSource,
        description:      req.body.stripeDescription,
    }, function(err, charge) {
        
        console.log("charge callback: error:", err)
        console.log("charge callback: charge:", charge)
        
        // record error is something happened
        // Sync data
        if(err) {
          var ref = new Firebase(FBURL);
          var onComplete = function(error) {
          if (error) {
              console.log("fb sync charge error: error: " + error)
              //res.send("Something went wrong... Try again on Noodl.io: " + error);
            } else {
              console.log("fb sync charge error: success: ")
              //res.send("Success! Your account is now setup to use Stripe Connect. You may close this window. <br><br> You can now refresh your settings in your app");
            }
          };
          
          // <--
          ref.child("feedback").child("stripe_charge_error").child(req.body.stripeBuyerId).child(req.body.stripeProductId).push({
              type: err.type,
              message: err.message,
              statusCode: err.statusCode,
              date: Firebase.ServerValue.TIMESTAMP
            }, 
            onComplete);
          res.json(err);
          
        } else {
          // <--
          res.json(charge);   
        }
        
    });
});

router.post('/charge', function(req, res) {
    
    console.log("--------- charge")
    console.log("charge: buyerId:", req.body.stripeBuyerId)
    console.log("charge: productId:", req.body.stripeProductId)
    
    console.log("charge: amount:", req.body.stripeAmount)
    console.log("charge: currency:", req.body.stripeCurrency)
    console.log("charge: source:", req.body.stripeSource)
    console.log("charge: description", req.body.stripeDescription)
    console.log("charge: destination", req.body.stripeConnectedAccountId)
    console.log("charge: noodlio fee", req.body.applicationFee)
    
    var charge = stripe.charges.create(
      {
        amount:           req.body.stripeAmount,                // amount in cents, again
        currency:         req.body.stripeCurrency,
        source:           req.body.stripeSource,
        description:      req.body.stripeDescription,
        application_fee:  req.body.applicationFee
      },
      {stripe_account: req.body.stripeConnectedAccountId},
      function(err, charge) {
        // check for `err`
        // do something with `charge`
        console.log("charge callback: error:", err)
        console.log("charge callback: charge:", charge)
        
        /**
        if (err && err.type === 'StripeCardError') {
            res.json(err);   
        } else {
            res.json(charge);   
        }
        **/
        
        // record error is something happened
        // Sync data
        if(err) {
          var ref = new Firebase(FBURL);
          var onComplete = function(error) {
          if (error) {
              console.log("fb sync charge error: error: " + error)
            } else {
              console.log("fb sync charge error: success: ")
            }
          };
          
          // <--
          ref.child("feedback").child("stripe_charge_error").child(req.body.stripeBuyerId).child(req.body.stripeProductId).push({
              type: err.type,
              message: err.message,
              statusCode: err.statusCode,
              date: Firebase.ServerValue.TIMESTAMP
            }, 
            onComplete);
          res.json(err);
          
        } else {
          // <--
          res.json(charge);   
        }

      }
    );
});


router.post('/charge/customer', function(req, res) {
    
    console.log("--------- charge/customer")
    console.log("charge/customer: buyerId:", req.body.stripeBuyerId)
    console.log("charge/customer: productId:", req.body.stripeProductId)
    
    console.log("charge/customer: amount:", req.body.stripeAmount)
    console.log("charge/customer: currency:", req.body.stripeCurrency)
    console.log("charge/customer: source:", req.body.stripeSource)
    console.log("charge/customer: customerId:", req.body.stripeCustomerId)
    console.log("charge/customer: description", req.body.stripeDescription)
    
    var charge = stripe.charges.create({
        amount:           req.body.stripeAmount,                // amount in cents, again
        currency:         req.body.stripeCurrency,
        description:      req.body.stripeDescription,
        customer:         req.body.stripeCustomerId,
    }, function(err, charge) {
        // check for `err`
        // do something with `charge`
        console.log("charge callback: error:", err)
        console.log("charge callback: charge:", charge)
        
        /**
        if (err && err.type === 'StripeCardError') {
            res.json(err);   
        } else {
            res.json(charge);   
        }
        **/
        
        // record error is something happened
        // Sync data
        if(err) {
          var ref = new Firebase(FBURL);
          var onComplete = function(error) {
          if (error) {
              console.log("fb sync charge error: error: " + error)
            } else {
              console.log("fb sync charge error: success: ")
            }
          };
          
          // <--
          ref.child("feedback").child("stripe_charge_error").child(req.body.stripeBuyerId).child(req.body.stripeProductId).push({
              type: err.type,
              message: err.message,
              statusCode: err.statusCode,
              date: Firebase.ServerValue.TIMESTAMP
            }, 
            onComplete);
          res.json(err);
          
        } else {
          // <--
          res.json(charge);   
        }

      }
    );
});


/** 
 * =============================================================================
 * Stripe Customers
 * =============================================================================
 */
router.post('/savecustomer', function(req, res) {
    
    console.log("--------- save-customer")
    console.log("save-customer: buyerId:", req.body.stripeToken)
    
    var tokenID = req.body.stripeToken;

    // Create a Customer
    // https://stripe.com/docs/connect/shared-customers
    stripe.customers.create({
      source: tokenID,
      description: "Customer"
    }, function(err, customer) {
      if(err){
        console.log(err)
        res.json(err);
      } else {
        console.log(customer)
        res.json(customer);
      }
    });
    
});

router.post('/createtoken', function(req, res) {
    
    console.log("--------- create-token")
    console.log("create-token: customerId:",  req.body.stripeCustomerId)
    console.log("create-token: accountId:",   req.body.stripeConnectedAccountId)
    
    var CUSTOMER_ID                     = req.body.stripeCustomerId;
    var CONNECTED_STRIPE_ACCOUNT_ID     = req.body.stripeConnectedAccountId;

    // Create a Token from the existing customer on the platform's account
    // https://stripe.com/docs/connect/shared-customers
    stripe.tokens.create(
      { customer: CUSTOMER_ID},
      { stripe_account: CONNECTED_STRIPE_ACCOUNT_ID }, // id of the connected account
      function(err, token) {
        // callback
        if(err){
          console.log(err)
          res.json(err);
        } else {
          console.log('create-token', token)
          res.json(token);
        }
      }
    );
    
});



/** 
 * =============================================================================
 * Stripe connect
 * =============================================================================
 */

var session = require('express-session')

//app.use(express.cookieParser());
app.use(session({
  genid: function(req) {
    return genuuid() // use UUIDs for session IDs 
  },
  resave: false,
  saveUninitialized: false,
  secret: 'semin de pemin'
}))
function genuuid() {
  return Math.floor(Math.random()*100000000);
}

router.get('/authorize', function(req, res) {
  
  console.log("--------- authorize")
  console.log("authorize: userId: ",  req.query.userId)
  console.log("authorize: token: ",   req.query.token)
  
  session["cookie"] = {
    userId: req.query.userId,
    fbAuthToken: req.query.token
  };
  
  res.redirect(AUTHORIZE_URI + '?' + qs.stringify({
    response_type: 'code',
    scope: 'read_write',
    client_id: CLIENT_ID
  }));
  
  
})

router.get('/oauth/callback', function(req, res) {

  console.log("--------- callback")
  console.log("get code: ", req.query.code)
  console.log("get userId: ", session["cookie"].userId)
  
  var code        = req.query.code; 
  var userId      = session["cookie"].userId;
  var fbAuthToken = session["cookie"].fbAuthToken;

  // Make /oauth/token endpoint POST request
  request.post({
    url: TOKEN_URI,
    form: {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code: code,
      client_secret: STRIPE_API_SECRET_KEY
    }
  }, function(err, r, body) {
    
    var SCData = JSON.parse(body);
    
    console.log("--------- fb synchronization")
    console.log("fb sync: stripe_connect_auth/" + userId)
    
    /**
     * Save in Firebase
     */
     
    // Authenticate
    var ref = new Firebase(FBURL);
    ref.authWithCustomToken(fbAuthToken, 
      function(error, authData) {
        if (error) {
          console.log("fb sync: auth: error:", error);
        } else {
          //
          // -->
          console.log("fb sync: auth: success:", authData);
          syncFBData();
        }
      }, {
      remember: "sessionOnly"
    });
    
    // Sync data
    function syncFBData() {
      var onComplete = function(error) {
      if (error) {
          console.log("fb sync: error: " + error)
          res.send("Something went wrong... Try again " + error);
        } else {
          console.log("fb sync: success: ")
          res.send("Success! Your account is now setup to use Stripe Connect. You may close this window. <br><br> You can now refresh your settings in your app");
        }
      };
      
      ref.child("stripe_connect_auth").child(userId).set(SCData, onComplete);
    };
    
    
  });
})


/** 
 * =============================================================================
 * Firebase Authentication
 * =============================================================================
 */

var FirebaseTokenGenerator  = require("firebase-token-generator");
var tokenGenerator          = new FirebaseTokenGenerator(FIREBASE_SECRET_KEY);

router.post('/firebase/generatetoken', function(req, res) {
    
    console.log("--------- charge")
    
    //console.log("fb auth: userId:", req.query.userId)
    console.log("fb auth: userId:", req.body.userId)
    
    var token                   = tokenGenerator.createToken({uid: req.body.userId});
    
    res.json(token);   
});


/** 
 * =============================================================================
 * Node Mailer
 * http://blog.ragingflame.co.za/2012/6/28/simple-form-handling-with-express-and-nodemailer
 * 1. npm install nodemailer
 * 2. npm install xoauth2 --save
 * 2. copy paste this
 * =============================================================================
 */


router.post('/email/send', function(req, res) {
    
    console.log("--------- email/send")
    console.log("--------- email/send - from:", req.body.senderName + ' &lt;' + req.body.senderEmail + '&gt;')
    console.log("--------- email/send - to:", req.body.receiverEmail)
    console.log("--------- email/send - subject:", req.body.subject)
    console.log("--------- email/send - html:")
    
    
    
    nodemailerMailgun.sendMail({
      from: req.body.senderName + '<' + req.body.senderEmail + '>',
      to: req.body.receiverEmail, // An array if you have multiple recipients.
      subject: req.body.subject,
      html: req.body.html,
    }, function (err, info) {
      if (err) {
        console.log('Error: ' + err);
        res.json(err);
      }
      else {
        console.log('Response: ' + info);
        res.json(info);
      }
    });
});






// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/', router); // register our route
app.listen(port);
console.log('Magic happens on port ' + port);

