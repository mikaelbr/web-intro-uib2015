(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function(){
	var Socket, myoList = {};
	if(typeof window === 'undefined'){
		Socket = require('ws');
	}else {
		if(!("WebSocket" in window)) console.error('Myo.js : Sockets not supported :(');
		Socket = WebSocket;
	}

	Myo = {
		defaults : {
			api_version : 3,
			socket_url  : "ws://127.0.0.1:10138/myo/",
		},
		lockingPolicy : 'standard',
		events : [],
		myos : [],

		onError : function(){
			throw 'Myo.js had an error with the socket. Myo Connect might not be running. If it is, double check the API version.';
		},

		setLockingPolicy: function(policy) {
			Myo.socket.send(JSON.stringify(['command',{
				"command": "set_locking_policy",
				"type": policy
			}]));
			Myo.lockingPolicy = policy;
			return Myo;
		},
		trigger : function(eventName){
			var args = Array.prototype.slice.apply(arguments).slice(1);
			emitter.trigger.call(Myo, Myo.events, eventName, args);
			return Myo;
		},
		on : function(eventName, fn){
			return emitter.on(Myo.events, eventName, fn);
		},
		off : function(eventName){
			Myo.events = emitter.off(Myo.events, eventName);
			return Myo;
		},

		connect : function(){
			Myo.socket = new Socket(Myo.defaults.socket_url + Myo.defaults.api_version);
			Myo.socket.onmessage = Myo.handleMessage;
			Myo.socket.onopen = Myo.trigger.bind(Myo, 'ready');
			Myo.socket.onclose = Myo.trigger.bind(Myo, 'socket_closed');
			Myo.socket.onerror = Myo.onError;
		},
		disconnect : function(){
			Myo.socket.close();
		},

		handleMessage : function(msg){
			var data = JSON.parse(msg.data)[1];
			if(!data.type || typeof(data.myo) === 'undefined') return;
			if(data.type == 'paired'){
				Myo.myos.push(Myo.create({
					macAddress      : data.mac_address,
					name            : data.name,
					connectIndex    : data.myo
				}));
			}

			Myo.myos.map(function(myo){
				if(myo.connectIndex === data.myo){
					var isStatusEvent = true;
					if(eventTable[data.type]){
						isStatusEvent = eventTable[data.type](myo, data);
					}
					if(!eventTable[data.type] || isStatusEvent){
						myo.trigger(data.type, data, data.timestamp);
						myo.trigger('status', data, data.timestamp);
					}
				}
			})
		},

		create : function(props){
			var myoProps = utils.merge({
				macAddress      : undefined,
				name            : undefined,
				connectIndex    : undefined,
				locked          : true,
				connected       : false,
				synced          : false,
				batteryLevel    : 0,
				lastIMU         : undefined,
				arm             : undefined,
				direction       : undefined,
				warmupState     : undefined,
				orientationOffset : {x : 0,y : 0,z : 0,w : 1},
				events : [],
			}, props || {});
			return utils.merge(Object.create(Myo.methods), myoProps);
		},

		methods : {
			trigger : function(eventName){
				var args = Array.prototype.slice.apply(arguments).slice(1);
				emitter.trigger.call(this, Myo.events, eventName, args);
				emitter.trigger.call(this, this.events, eventName, args);
				return this;
			},
			_trigger : function(eventName){
				var args = Array.prototype.slice.apply(arguments).slice(1);
				emitter.trigger.call(this, this.events, eventName, args);
				return this;
			},
			on : function(eventName, fn){
				return emitter.on(this.events, eventName, fn);
			},
			off : function(eventName){
				this.events = emitter.off(this.events, eventName);
				return this;
			},
			lock : function(){
				Myo.socket.send(JSON.stringify(["command", {
					"command": "lock",
					"myo": this.connectIndex
				}]));
				return this;
			},
			unlock : function(hold){
				Myo.socket.send(JSON.stringify(["command", {
					"command": "unlock",
					"myo": this.connectIndex,
					"type": (hold ? "hold" : "timed")
				}]));
				return this;
			},
			zeroOrientation : function(){
				this.orientationOffset = utils.quatInverse(this.lastQuant);
				this.trigger('zero_orientation');
				return this;
			},
			vibrate : function(intensity){
				intensity = intensity || 'medium';
				Myo.socket.send(JSON.stringify(['command',{
					"command": "vibrate",
					"myo": this.connectIndex,
					"type": intensity
				}]));
				return this;
			},
			requestBluetoothStrength : function(){
				Myo.socket.send(JSON.stringify(['command',{
					"command": "request_rssi",
					"myo": this.connectIndex
				}]));
				return this;
			},
			requestBatteryLevel : function(){
				Myo.socket.send(JSON.stringify(['command',{
					"command": "request_battery_level",
					"myo": this.connectIndex
				}]));
				return this;
			},
			streamEMG : function(enabled){
				Myo.socket.send(JSON.stringify(['command',{
					"command": "set_stream_emg",
					"myo": this.connectIndex,
					"type" : (enabled ? 'enabled' : 'disabled')
				}]));
				return this;
			}
		}
	};

	var eventTable = {
		//Stream Events
		'pose' : function(myo, data){
			if(myo.lastPose){
				myo.trigger(myo.lastPose + '_off');
				myo.trigger('pose_off', myo.lastPose);
			}
			if(data.pose == 'rest'){
				myo.trigger('rest');
				myo.lastPose = null;
				if(Myo.lockingPolicy === 'standard') myo.unlock();
			}else{
				myo.trigger(data.pose);
				myo.trigger('pose', data.pose);
				myo.lastPose = data.pose;
				if(Myo.lockingPolicy === 'standard') myo.unlock(true);
			}
		},
		'orientation' : function(myo, data){
			myo.lastQuant = data.orientation;
			var ori = utils.quatRotate(myo.orientationOffset, data.orientation);
			var imu_data = {
				orientation : ori,
				accelerometer : {
					x : data.accelerometer[0],
					y : data.accelerometer[1],
					z : data.accelerometer[2]
				},
				gyroscope : {
					x : data.gyroscope[0],
					y : data.gyroscope[1],
					z : data.gyroscope[2]
				}
			};
			if(!myo.lastIMU) myo.lastIMU = imu_data;
			myo.trigger('orientation',   imu_data.orientation, data.timestamp);
			myo.trigger('accelerometer', imu_data.accelerometer, data.timestamp);
			myo.trigger('gyroscope',     imu_data.gyroscope, data.timestamp);
			myo.trigger('imu',           imu_data, data.timestamp);
			myo.lastIMU = imu_data;
		},
		'emg' : function(myo, data){
			myo.trigger(data.type, data.emg, data.timestamp);
		},


		//Status Events
		'arm_synced' : function(myo, data){
			myo.arm = data.arm;
			myo.direction = data.x_direction;
			myo.warmupState = data.warmup_state;
			myo.synced = true;
			return true;
		},
		'arm_unsynced' : function(myo, data){
			myo.arm = undefined;
			myo.direction = undefined;
			myo.warmupState = undefined;
			myo.synced = false;
			return true;
		},
		'connected' : function(myo, data){
			myo.connectVersion = data.version.join('.');
			myo.connected = true;
			return true;
		},
		'disconnected' : function(myo, data){
			myo.connected = false;
			return true;
		},
		'locked' : function(myo, data){
			myo.locked = true;
			return true;
		},
		'unlocked' : function(myo, data){
			myo.locked = false;
			return true;
		},
		'warmup_completed' : function(myo, data){
			myo.warmupState = 'warm';
			return true;
		},

		'rssi' : function(myo, data){
			data.bluetooth_strength =  utils.getStrengthFromRssi(data.rssi);
			myo.trigger('bluetooth_strength', data.bluetooth_strength, data.timestamp);
			myo.trigger('rssi', data.rssi, data.timestamp);
			myo.trigger('status', data, data.timestamp);
		},
		'battery_level' : function(myo, data){
			myo.batteryLevel = data.battery_level;
			myo.trigger('battery_level', data.battery_level, data.timestamp);
			myo.trigger('status', data, data.timestamp);
		},
	};


	var emitter = {
		eventCounter : 0,
		trigger : function(events, eventName, args){
			var self = this;
			events.map(function(event){
				if(event.name == eventName) event.fn.apply(self, args);
				if(event.name == '*'){
					var args_temp = args.slice(0);
					args_temp.unshift(eventName);
					event.fn.apply(self, args_temp);
				}
			});
			return this;
		},
		on : function(events, name, fn){
			var id = new Date().getTime() + "" + emitter.eventCounter++;
			events.push({
				id   : id,
				name : name,
				fn   : fn
			});
			return id;
		},
		off : function(events, name){
			events = events.reduce(function(result, event){
				if(event.name == name || event.id == name) {
					return result;
				}
				result.push(event);
				return result;
			}, []);
			return events;
		},
	};

	var utils = {
		merge : function(obj1,obj2){
			for(var attrname in obj2) { obj1[attrname] = obj2[attrname]; }
			return obj1;
		},
		quatInverse : function(q) {
			var len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
			return {
				w: q.w/len,
				x: -q.x/len,
				y: -q.y/len,
				z: -q.z/len
			};
		},
		quatRotate : function(q, r) {
			return {
				w: q.w * r.w - q.x * r.x - q.y * r.y - q.z * r.z,
				x: q.w * r.x + q.x * r.w + q.y * r.z - q.z * r.y,
				y: q.w * r.y - q.x * r.z + q.y * r.w + q.z * r.x,
				z: q.w * r.z + q.x * r.y - q.y * r.x + q.z * r.w
			};
		},
		getStrengthFromRssi : function(rssi){
			var min = -95;
			var max = -40;
			rssi = (rssi < min) ? min : rssi;
			rssi = (rssi > max) ? max : rssi;
			return Math.round(((rssi-min)*100)/(max-min) * 100)/100;
		},
	};

	if(typeof module !== 'undefined') module.exports = Myo;
})();





},{"ws":2}],2:[function(require,module,exports){

/**
 * Module dependencies.
 */

var global = (function() { return this; })();

/**
 * WebSocket constructor.
 */

var WebSocket = global.WebSocket || global.MozWebSocket;

/**
 * Module exports.
 */

module.exports = WebSocket ? ws : null;

/**
 * WebSocket constructor.
 *
 * The third `opts` options object gets ignored in web browsers, since it's
 * non-standard, and throws a TypeError if passed to the constructor.
 * See: https://github.com/einaros/ws/issues/227
 *
 * @param {String} uri
 * @param {Array} protocols (optional)
 * @param {Object) opts (optional)
 * @api public
 */

function ws(uri, protocols, opts) {
  var instance;
  if (protocols) {
    instance = new WebSocket(uri, protocols);
  } else {
    instance = new WebSocket(uri);
  }
  return instance;
}

if (WebSocket) ws.prototype = WebSocket.prototype;

},{}],3:[function(require,module,exports){

var myo = require('./remark-myo');

setupSlideshow();
setupSoundButton();

document.querySelector('#change-image').addEventListener('click', function (e) {
  e.preventDefault();
  var myImage = document.querySelector('#my-image-1');
  myImage.src = 'assets/dance.gif';
});

var myImage2 = document.querySelector('#my-image-2');
myImage2.addEventListener('click', function (e) {
  e.preventDefault();
  myImage2.src = 'assets/dance.gif';
});


function setupSlideshow () {
  var data = "class: front-page\n\n# Introduksjon til Web-teknologi\n## Et lite innblikk i det moderne web\n\nMikael Brevik\n\n07/09/2015\n\n---\nclass: agenda\n\n# Del 1: Grunnleggende Interaksjon\n\n * Historie\n * Hva er Web?\n * Apps, været og likes\n\n---\nclass: agenda\n\n# Del 2: HTML, CSS og JavaScript\n\n* HTML: Innhold\n* CSS: Design\n* JavaScript: Oppførsel\n* Web and Beyond\n\n---\nclass: middle center\n\n![Windows 95 Dail Up](assets/win95dialup.png)\n\n<a href=\"#\" class=\"btn\" id=\"sound-button\">Lyd</a>\n\n???\n\nHastigheter var typisk rundt 28 kbps eller 56 kbps. Etterhvert var det noen heldige som hadde ISDN og kunne bruke dobbel linje for å øke det til 128 kbps! Det kunne bety en vanlig MP3 sang på rundt 5 minutter. Som var veldig, veldig raskt. Jeg husket jeg lå på rundt nedlastingshastighet på 6 KB/s. Som gjorde at om alle planeter lå på linje, kunne jeg laste ned en sang på rundt 12 minutter.\n\n---\nbackground-image: url(assets/ie20years.jpg)\n\n???\n\nHer er et bilde av Internet Explorer 1 i Windows 95, som er 20 år nå!\n\n---\nbackground-image: url(assets/apple-website.png)\nclass: middle center\n\n???\n\nPå grunn av lav hastighet, lite modent teknologi, store krangler mellom nettlesere osv, var det ikke veldig mye man kunne gjøre på web-en i starten. Det var for det meste mye tekst og noen bilder. Dette er et bilde av Apple sine sider fra 1997, som ellers er forholdsvis kjent for sin gode design-stil.\n\nLegg særlig merke til datoen som står oppe i høyre hjørne. Av en eller annen grunn var det utrolig vanlig for nettsider å vise klokke og/eller dato på nettsiden.\n\n---\nclass: middle center\n\n![Windows 95 bar](assets/clock.png)\n\n???\n\nMen det var ikke slik at det var et behov for det. I 97, var det vanligste OS-et Windows 95, eller kanskje Windows 98. Men begge hadde startlinja der klokken var synlig hele tiden.\n\n---\nbackground-image: url(assets/google.png)\nclass: middle center\n\n???\n\nDa Google kom, kanskje først for fullt rundt 1998, ble det plutselig mulig å skikkelig kunne søke på nettet etter innhold. Starten på informasjonsalderen der vi kunne ha all slags mulig \"redaktørstyrt\" innhold.  \n\n---\nbackground-image: url(assets/ms-encarta.jpg)\nclass: middle center\n\n???\n\nFør internett ble kraftig nok, måtte man kjøpe det meste på disketter eller CD-er dersom man ville ha noe digitalt. Det var ikke båndbredde til å laste ned noe særlig stort. Et eksempel på noe vi kanskje tar for gitt i dag er leksikon på nett. Før var det Encarta som Microsoft ga ut. Der kunne man lese om alt slags mulig interessant.\n---\nbackground-image: url(assets/encarta-game.jpg)\nclass: middle center\n\n???\n\ndet var til og med et uhyre langsomt spill som jeg aldri klarte å komme meg noe langt på.\n\n---\nbackground-image: url(assets/first-wikipedia.png)\nclass: middle center\n\n???\n\nI 2001, fikk vi selvfølgelig Wikipedia som var første store lexicon på nett. I den tiden hadde også med seg alderen for brukergenerert innhold. Ikke lengre skulle det bare være \"redaktørstyrt\" innhold. Innhold der det var noen webmasters og de som sto bak sidene skulle legge ut, men brukerne av sidene skulle bidra til å legge ut innhold.\n\nWikier er selvfølgelig av den typen side. Alle brukere kan opprette innhold i en Wiki, og redaktørjobben blir overlatt til miljøet. Noe som har vist seg å fungere for mange sider.\n\n\n---\nbackground-image: url(assets/digg-2004.png)\n\n\n???\n\nEtt av de nettstedene som var tidlig ute med brukergenerert innhold var siden Digg. Digg var (og er vel kanskje fremdeles) en nyhetsaggregeringsside. Som da er sider som samler lenker til alle slags andre sider. I dag er Digg ikke like populært, men de fleste av brukerene har gått over til Reddit, som kanskje de aller fleste kjenner til.\n\n---\nbackground-image: url(assets/first-facebook.png)\n\n\n???\n\nPå samme tiden, rundt 2004, kom det en ganske kjent side for mange. Riktig nok, så ble den først den Facebook vi kjenner i dag rundt 2008. Da kom det et stort re-design og den fikk flesteparten av de featurene vi ser. I Norge hadde vi først noen andre sider som løste mye av de samme \"behovene\".\n\n---\nbackground-image: url(assets/blink.png)\n\n???\n\nFørst var Dagbladets blink en stor greie\n\n---\nbackground-image: url(assets/nettby.png)\n\n???\n\nOg VG kunne selvfølgelig ikke være noe dårligere og kjøpte opp Nettby, som etterhvert tok mer eller mindre over for Blink.\n\nVi var inne i en ny alder der det ble mer og mer populært å være sosial på nettet. Vi skulle ikke bare lese informasjon og dele informasjon, men vi skulle interagere med mennesker. I denne tiden begynte ting å bevege selv veldig raskt. Samtidig som sosiale medier ble født, fikk vi også underholdning i mye større grad.\n\n---\nbackground-image: url(assets/janetjackson.jpg)\n\n\n???\n\nI 2004, gjorde Janet Jackson og Justin Timberlake et stort stunt på Super Bowl. En så stor kontrovers at etter dette blir alle live-sendinger satt med en delay på 5 sekunder for å kunne kontrollere slik.\n\nEtter over å frustrere seg over at det ikke var mulig å finne videoen noe sted, bestemte Hurley, Chen og Karin seg for å lage YouTube.\n\n---\nbackground-image: url(assets/first-youtube.png)\n\n\n???\n\nFørst, skulle YouTube være en slags Online Dating side bare for videoer. Etterhvert muterte derimot Youtube til å bli mer likt det vi kjenner det som i dag.\n\n---\nbackground-image: url(assets/second-youtube.png)\n\n\n???\n\nEn side der hvor alle kan dele alle slags videoer.\n\n---\nbackground-image: url(assets/first-iphone.jpg)\n\n???\n\nMot 2007, skjedde det noe annet stort. Vi fikk skikkelig fungerende smart-telefoner. I alle fall starten på en fungerende smartphone. I utgangspunktet var det f.eks ikke en App Store. Tanken var at det skulle være web-apps på alt. Man skulle kun bruke weben til å gjøre alt man trengte. Men behovet kom for å ha mer native apps og App Storen ble født. Men det betyr ikke at Web-teknologi ikke blir brukt til de.\n\n---\nclass: middle center\n\n![Wordfeud](assets/wordfeud.jpeg)\n\n???\n\nF.eks apper som Wordfeud.\n\n---\nclass: middle center\n\n![Angry birds](assets/angrybirds.jpg)\n\n???\n\nEller ting som Angry Birds.\n\n---\nclass: middle center\n\n![Fun Run](assets/funrun.jpg)\n\n???\n\nEller Fun Run..\n\n\n---\nclass: middle center\n\n# Hva er Web?\n\n???\n\nMen først. Hva er egentlig web? Hvordan funker det?\n\n---\nclass: middle center\n\n![Request/Response](assets/request-response.png)\n\n???\n\nNettleseren sender en spørring inn til en tjener ved å slå opp i et register for å endre fra domene til en adresse (IP). Så får man svar med tjeneren om man finner et innhold eller ikke. Dersom innholdet finnes kommer innholdet også.\n\n---\n\n# Request\n\n```\ncurl -v http://www.vg.no\n```\n\n```\n* Connected to www.vg.no (195.88.55.16) port 80 (#0)\n> GET / HTTP/1.1\n> User-Agent: curl/7.37.1\n> Host: www.vg.no\n> Accept: */*\n```\n\n\n---\n# Response\n\n```\n< HTTP/1.1 200 OK\n< Server: Apache/2.2.15 (CentOS)\n< X-VG-WebServer: vgphoenix-web-03\n< Last-Modified: Sun, 16 Aug 2015 19:15:45 GMT\n< Content-Type: text/html; charset=UTF-8\n< X-VG-SolveMe: uggc://jjj.it.ab/ynxfrgngg.ugzy\n< Cache-Control: max-age=30,must-revalidate\n< Transfer-Encoding: chunked\n< Date: Sun, 16 Aug 2015 19:18:48 GMT\n< Connection: keep-alive\n< X-Cache: HIT:4326\n< Vary: Accept-Encoding,User-Agent\n< X-VG-WebCache: m323-varnish-01\n< X-Age: 174\n< Age: 0\n```\n\n---\nbackground-image: url(assets/carusel.gif)\nclass: middle center\n\n???\n\nAll den teknologien slik at vi kan se gif-er på nett.\n\n\n---\n\n# HTTP\n\n_Hypertext Transfer Protocol_\n\nEr en protokoll for å kommunisere mellom systemer.\n\n---\n# HTTP: Verb\n\nVerb: Definerer hva man ønsker å gjøre.\n\n```\nGET\nPOST\nPUT\nDELETE\n...\n```\n---\n# HTTP: Statuskoder\n\nStatuskoder: Hva ble resultatet?\n\n```\n200 - OK\n404 - Not Found\n403 - Forbidden\n500 - Internal Server Error\n418 - I'm a teapot\n```\n\n---\nclass: middle center\n\n\n# Apps, været og likes\n\n???\n\nSå hvordan er Web relatert til Apps og alt vi gjør på telefonen, tablets, etc, hver dag?\n\n---\nbackground-image: url(assets/phone-response.png)\n\n\n???\n\nI bakgrunnen, isteden for at vi går direkte inn på en nettadresse, et domene, så gjør appen det for oss.\n\n---\nbackground-image: url(assets/yr.png)\n\n???\n\nSå f.eks, om Yr skal hente ut været. Går den egentlig inn på en nettaddresse i bakgrunnen, som henter ut et format som dataen kan lese og lage et grensesnitt ut av.\n\n---\n\n```\nhttp://www.yr.no/place/Norway/Hordaland/Bergen/Bergen/varsel.xml\n```\n\n```xml\n<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<weatherdata>\n  <location>\n    <name>Bergen</name>\n    <type>City - large town</type>\n    <country>Norway</country>\n    <timezone id=\"Europe/Oslo\" utcoffsetMinutes=\"120\" />\n    <location altitude=\"54\" latitude=\"60.3982548886088\" longitude=\"5.3290477619655\" geobase=\"ssr\" geobaseid=\"92416\" />\n  </location>\n  <sun rise=\"2015-09-07T06:46:00\" set=\"2015-09-07T20:26:02\" />\n  <forecast>\n    <text>\n      <location name=\"Bergen\">\n        <time from=\"2015-09-07\" to=\"2015-09-07\">\n          <title>Monday</title>\n          <body>&lt;strong&gt;Hordaland:&lt;/strong&gt; Nordlig frisk bris på kysten. Utrygt for litt regn i ytre strøk, ellers for det meste pent vær.</body>\n        </time>\n```\n\n???\n\nSå om du åpner en nettside, vil nettleseren gå å hente ut innholdet til den nettsiden, og du vil få tilbake et format som nettleseren kan vise med et tilhørende design (kalt HTML og CSS). For apps, vil appen hente ut et innhold og få tilbake et format som kan konsumeres enkelt for den, f.eks JSON eller XML.\n\n---\nbackground-image: url(assets/facebook-app.png)\n\n???\n\nDet samme skjer når man f.eks trykker \"Like\" på Facebook App-en. Facebook går i bakgrunnen og åpner en side, som gjør den handlingen man ønsker.\n\n\n---\n\n```\nhttp://api.facebook.com/actions/do-like/01307572/some-post\n```\n\n```json\n{\n  \"success\": true,\n  \"likes\": 56,\n  \"youLiked\": true\n}\n```\n\n???\n\nVi kan forestille oss at den ser ut som noe slik, for eksempel.\n\n---\nclass: middle center\n\n![Fun Run](assets/funrun.jpg)\n\n???\n\nSamme da med fun run. Bare at man kan tenke seg at man sender litt andre ting. F.eks kan det være at den kontinuerlig sender sin posisjon til en server som igjen sprer den videre til alle andre mobil-telefoner som er med i spillet.\n\n---\n\n# Request\n\n```\nPOST http://api.some-funrun-page.com/coordinates/game-id/12f938abc321adf\n```\n\n## Body\n```json\n{ \"x\": 1205, \"y\": 300 }\n```\n\n# Response\n```json\n{ \"message\": \"ok\" }\n```\n\n???\nEgenltig, i Fun Runs tilfelle vil det nok være krav til veldig mange requests i\nsekundet, så der er det mulig de bruker en lavere nivås protokoll, f.eks TCP eller UDP\navhengig av om de vil ha bekreftelse på om requesten kom igjennom.\n\n---\n\nclass: agenda\n\n# Del 2: HTML, CSS og JavaScript\n\n * HTML: Innhold\n * CSS: Design\n * JavaScript: Oppførsel\n * Web and Beyond\n\n\n---\n\n# HTML: Innhold\n\n## _HyperText Markup Language_\n\n_Markup: Et språk for å definere hvordan vi vil at strukturen på en nettside skal være._\n\n\n## Format\n\n```html\n<tag attribute=\"attribute-value\">content</tag>\n```\n\n```html\n<img src=\"some-funny.gif\" alt=\"This is a funny gif\" />\n```\n\n---\n\n# HTML\n\n```html\n<h1>Min sidetittel</h1>\n<p>\n  Dette er et avsnitt med litt <strong>fet tekst</strong>\n  og en <a href=\"https://bekk.no/\">kul lenke</a>.\n</p>\n```\n\n---\n\n# HTML\n\n```html\n<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\">\n    <title>Web Intro 2015</title>\n  </head>\n  <body>\n    <h1>Min sidetittel</h1>\n  </body>\n</html>\n```\n\n\n---\n\n# CSS: Design\n\n## _Cascading Style Sheets_\n\n_Stilsett definert som design for nettsiden din._\n\n## Format\n\n```CSS\nselector {\n  property: value;\n}\n```\n\nInkluderes i HTML ved en `<link>`-tag\n```html\n<link href=\"stylesheet.css\" type=\"text/css\" rel=\"stylesheet\">\n```\n\n---\n\n# CSS\n\n```CSS\narticle h1 {\n  font-size: 150%;\n  color: #FF0000; /* same as red */\n}\n```\n\n<h1 style=\"font-size: 150%; color: #FF0000;\">Min tittel</h1>\n\n---\n# CSS\n\n```CSS\narticle img {\n  width: 350px;\n  float: left;\n}\n```\n\n<img style=\"width: 350px; float: left;\" src=\"./assets/kungfubaby.gif\" alt=\"Kung Fu Baby\" />\n<h1 style=\"font-size: 150%; color: #FF0000;\">Min tittel</h1>\n\n---\n\n# CSS: Selectorer\n\nMan kan velge elementer ut i fra tag, ID, klasse (og litt til)\n\n```html\n<img id=\"my-image\" class=\"image\" src=\"./assets/kungfubaby.gif\" alt=\"Kung Fu Baby\" />\n```\n\n```CSS\n/* Alle henter ut samme element: */\nimg { /* .. */ }\n#my-image { /* .. */ }\n.image { /* .. */ }\n\n/* Til og med kombinere */\nimg#my-image.image { /* .. */ }\n/* notis: Ikke en god idé, ytelses-messig */\n```\n\n\n---\n\n# JavaScript\n\nEt programmeringsspråk. Brukt til å gjøre dynamisk endringer på HTML og CSS.\nIkke relatert til «Java»\n\n> \"Java is to Javascript, as Car is to Carpenter\"\n> – Someone\n\n## Eksempel\n\n```js\nvar hello = 'Hello, ';\nvar name = 'UIB';\nvar helloUib = hello + name; //> 'Hello, UIB'\n```\n\n---\n\n# Javascript\n\nInkluderes i HTML ved en `<script>`-tag\n```html\n<script src=\"myFile.js\" type=\"text/javascript\"></script>\n\n// Or inline\n\n<script type=\"text/javascript\">\nvar hello = 'Hello!';\n</script>\n```\n\n\n---\n# JavaScript\n\n```js\n// Som med matte: f(x, y) = x + y\nvar add = function (x, y) {\n  return x + y;\n};\n\n// Som med matte f(40, 2) -> 42\nvar number = add(40, 2); //> 42\n\nvar number2 = add(add(20, 20), 2); //> 42\n\n```\n\n---\n# JavaScript\n\n```js\nvar add = function (x, y) {\n  return function (y) {\n    return x + y;\n  };\n};\n\nvar add40 = add(40); //> new function\nvar number = add40(2); //> 42\n```\n---\n# JavaScript\n\nFor spesielt interesserte: Partial applications\n\n```js\nvar add = (x, y) => x + y;\nvar add40 = add.bind(null, 40); //> new function\nvar number = add40(2); //> 42\n```\n\n---\n# JavaScript\n\nKan konstruere *objeker* som holder på informasjon:\n\n```js\nvar myPoint = { x: 40, y: 2 };\n\n// Funksjon som tar inn point:\nvar add = function (point) {\n  return point.x + point.y;\n};\nadd(myPoint); //> 42\n```\n\n---\n# JavaScript\n\nOgså for spesielt interesserte: Dekonstruere objekter\n\n```js\nvar add = ({x, y}) => x + y;\nadd({ x: 40, y: 2 }); //> 42\n```\n\n\n---\n# JavaScript\n\nKommunisere med HTML\n\n```html\n<img src=\"assets/kungfubaby.gif\" id=\"my-image\" alt=\"Gif\" />\n```\n\nVi kan hente det ut i Javascript:\n\n```js\n// Samme selectorer som i CSS\nvar myImage = document.querySelector('#my-image');\n// flere bilder: document.querySelectorAll('.my-images');\n\n// Endre kilde til bilde\nmyImage.src = 'assets/dance.gif';\n```\n\n---\n# JavaScript\n\n<img src=\"assets/kungfubaby.gif\" id=\"my-image-1\" alt=\"Gif\" />\n<a href=\"#\" id=\"change-image\" class=\"btn\" id=\"sound-button\">Kjør kode</a>\n\n\n---\n# Javascript\n\nLytte til brukerinteraksjon.\n```html\n<img src=\"assets/kungfubaby.gif\" id=\"my-image\" alt=\"Gif\" />\n```\n\n```js\nvar myImage = document.querySelector('#my-image');\n\n// Lytte til når noen klikker på bildet\nmyImage.addEventListener('click', function () {\n  myImage.src = 'assets/dance.gif';\n});\n```\n\n---\n\n<img src=\"assets/kungfubaby.gif\" id=\"my-image-2\" alt=\"Gif\" />\n\n\n---\n\n# Javascript: Lister\n\n```js\nvar listOfNumbers = [5, 4, 3, 4, 5];\n\n// Første tall:\nlistOfNumbers[0]; //> 5\nlistOfNumbers[1]; //> 4\n\n// Gå over listen\nvar sum = 0;\nlistOfNumbers.forEach(function (number) {\n  sum = sum + number;\n});\n\nsum; //> 21\n```\n---\n\n# Javascript: Lister\n\nMer idiomatisk måte: Redusering\n\n\n```js\nvar listOfNumbers = [5, 4, 3, 4, 5];\n\nvar sum = listOfNumbers.reduce((acc, number) => acc + number);\nsum; //> 21\n```\n\n---\n\n# Javascript: Lister\n\nJavaScript er dynamisk. Så lister kan være hva som helst\n\n\n```js\nvar listOfNumbers = [5, '4', 3, { x: 3 }, true, [1, 2, 3]];\n\nvar sum = listOfNumbers\n  .filter(n => typeof n === 'number')\n  .reduce((acc, number) => acc + number);\nsum; //> 8\n```\n\n---\n\n# Javascript: AJAX\n\nI Javascript kan man gjøre HTTP-kall fra koden:\n\n```js\nhttpRequest.onreadystatechange = function() {\n  if (httpRequest.readyState === 4) {\n    var data = httpRequest.responseText;\n  }\n};\n\nhttpRequest.open('GET', 'http://bekk.no/');\nhttpRequest.send();\n```\n\n---\nclass: middle center\n\n# Demo: jifs!\n\n## Enkel side for GIF-er\n\n<a href=\"./example/static.html\" class=\"btn\" target=\"_blank\" id=\"sound-button\">Kjør demo</a>\n\n---\nclass: middle center\n\n# Demo: jifs!\n\n## Søkeside for GIF-er\n\n<a href=\"./example/index.html\" class=\"btn\" target=\"_blank\" id=\"sound-button\">Kjør demo</a>\n\n---\n\n# Oppsumert\n\n* HTTP – transport\n* HTML – Innhold\n* CSS – Design\n* JavaScript – Oppførsel\n\n---\nbackground-image: url(assets/racing.png)\nclass: cover\n\n# Racer S: WebGL\n\n<a href=\"http://helloracer.com/racer-s/\" class=\"btn\" target=\"_blank\" id=\"sound-button\">Kjør demo</a>\n\n\n---\nbackground-image: url(assets/gotham.png)\nclass: cover\n\n# Witness Gotham: WebGL\n\n<a href=\"http://witnessgotham.com//\" class=\"btn\" target=\"_blank\" id=\"sound-button\">Kjør demo</a>\n\n\n---\nbackground-image: url(assets/music.png)\nclass: cover\n\n# Technitone: Web Audio API\n\n<a href=\"http://www.technitone.com/gallery/recent\" class=\"btn\" target=\"_blank\" id=\"sound-button\">Kjør demo</a>\n\n\n---\nbackground-image: url(assets/quake.png)\nclass: cover\n\n# Quake: EMSCRIPTEN\n\n<a href=\"http://www.quakejs.com/\" class=\"btn\" target=\"_blank\" id=\"sound-button\">Kjør demo</a>\n\n\n---\nbackground-image: url(assets/ttd.png)\nclass: cover\n\n# Transport Tycoon Deluxe: EMSCRIPTEN\n\n<a href=\"http://epicport.com/en/ttd\" class=\"btn\" target=\"_blank\" id=\"sound-button\">Kjør demo</a>\n\n\n---\nclass: front-page\n\n# Spørsmål?\n\n## mikael.brevik@bekk.no – @mikaelbrevik\n\nSlides: http://github.com/mikaelbr/web-intro-uib2015\n";
  document.querySelector('#source').innerHTML = data;

  var slideshow = remark.create({
    ratio: '16:9',
    highlightStyle: 'monokai'
  });

  myo(slideshow);
}

function setupSoundButton () {
  var dialupButton = document.querySelector('#sound-button');
  var sound = null;
  dialupButton.addEventListener('click', function (e) {
    e.preventDefault();
    if (sound && sound.paused) {
      return sound.play();
    }
    if (sound && !sound.paused) {
      return sound.pause();
    }
    sound = new Audio('./assets/dial-up-modem-01.mp3');
    sound.play();
  }, false);
}

},{"./remark-myo":4}],4:[function(require,module,exports){
var Myo = require('myo');

module.exports = function connect (slideshow) {
  //Start talking with Myo Connect
  Myo.connect();
  Myo.on('pose', function (poseName) {
    // if (poseName === 'double_tap') {
    //   this.vibrate('short');
    //   if (!this.locked) {
    //     this.lock();
    //     this.vibrate('short');
    //   } else {
    //     this.unlock();
    //     this.vibrate('medium');
    //   }
    // }
    // else
    if (poseName === 'wave_in') {
      this.vibrate('short');
      slideshow.gotoPreviousSlide();
    }
    else if (poseName === 'wave_out') {
      this.vibrate('short');
      slideshow.gotoNextSlide();
    }
  });

  Myo.on('paired', function(){
    console.log('Myo connected');
    this.vibrate('long');
    Myo.setLockingPolicy('none');
  });
};

},{"myo":1}]},{},[3]);
