define(["Tone/core/Tone", "Tone/type/TimeBase"], function (Tone) {

	/**
	 *  @class Tone.Time is a primitive type for encoding Time values.
	 *         Tone.Time can be constructed with or without the `new` keyword. Tone.Time can be passed
	 *         into the parameter of any method which takes time as an argument.
	 *  @constructor
	 *  @extends {Tone.TimeBase}
	 *  @param  {String|Number}  val    The time value.
	 *  @param  {String=}  units  The units of the value.
	 *  @example
	 * var t = Tone.Time("4n");//a quarter note
	 */
	Tone.Time = function(val, units){
		if (this instanceof Tone.Time){

			Tone.TimeBase.call(this, val, units);

		} else {
			return new Tone.Time(val, units);
		}
	};

	Tone.extend(Tone.Time, Tone.TimeBase);

	/**
	 * Extend the base expressions
	 */
	Tone.Time.prototype._expressions = Object.assign({}, Tone.TimeBase.prototype._expressions, {
		"quantize" : {
			regexp : /^@(.+)/,
			method : function(capture){
				if (Tone.Transport){
					var quantTo = new Tone.Time(capture);
					return Tone.Transport.nextSubdivision(quantTo);
				} else {
					return 0;
				}
			}
		},
		"now" : {
			regexp : /^\+(.+)/,
			method : function(capture){
				return this._now() + (new Tone.Time(capture));
			}
		}
	});

	/**
	 *  Quantize the time by the given subdivision. Optionally add a
	 *  percentage which will move the time value towards the ideal
	 *  quantized value by that percentage.
	 *  @param  {Number|Time}  val    The subdivision to quantize to
	 *  @param  {NormalRange}  [percent=1]  Move the time value
	 *                                   towards the quantized value by
	 *                                   a percentage.
	 *  @return  {Number}  this
	 *  @example
	 * Tone.Time(21).quantize(2) //returns 22
	 * Tone.Time(0.6).quantize("4n", 0.5) //returns 0.55
	 */
	Tone.Time.prototype.quantize = function(subdiv, percent){
		percent = Tone.defaultArg(percent, 1);
		var subdivision = new this.constructor(subdiv);
		var value = this.valueOf();
		var multiple = Math.round(value / subdivision);
		var ideal = multiple * subdivision;
		var diff = ideal - value;
		return value + diff * percent;
	};

	///////////////////////////////////////////////////////////////////////////
	// CONVERSIONS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  Convert a Time to Notation. Values will be thresholded to the nearest 128th note.
	 *  @return {Notation}
	 *  @example
	 * //if the Transport is at 120bpm:
	 * Tone.Time(2).toNotation();//returns "1m"
	 */
	Tone.Time.prototype.toNotation = function(){
		var time = this.toSeconds();
		var testNotations = ["1m", "2n", "4n", "8n", "16n", "32n", "64n", "128n"];
		var retNotation = this._toNotationHelper(time, testNotations);
		//try the same thing but with tripelets
		var testTripletNotations = ["1m", "2n", "2t", "4n", "4t", "8n", "8t", "16n", "16t", "32n", "32t", "64n", "64t", "128n"];
		var retTripletNotation = this._toNotationHelper(time, testTripletNotations);
		//choose the simpler expression of the two
		if (retTripletNotation.split("+").length < retNotation.split("+").length){
			return retTripletNotation;
		} else {
			return retNotation;
		}
	};

	/**
	 *  Helper method for Tone.toNotation
	 *  @param {Number} units
	 *  @param {Array} testNotations
	 *  @return {String}
	 *  @private
	 */
	Tone.Time.prototype._toNotationHelper = function(units, testNotations){
		//the threshold is the last value in the array
		var threshold = this._notationToUnits(testNotations[testNotations.length - 1]);
		var retNotation = "";
		for (var i = 0; i < testNotations.length; i++){
			var notationTime = this._notationToUnits(testNotations[i]);
			//account for floating point errors (i.e. round up if the value is 0.999999)
			var multiple = units / notationTime;
			var floatingPointError = 0.000001;
			if (1 - multiple % 1 < floatingPointError){
				multiple += floatingPointError;
			}
			multiple = Math.floor(multiple);
			if (multiple > 0){
				if (multiple === 1){
					retNotation += testNotations[i];
				} else {
					retNotation += multiple.toString() + "*" + testNotations[i];
				}
				units -= multiple * notationTime;
				if (units < threshold){
					break;
				} else {
					retNotation += " + ";
				}
			}
		}
		if (retNotation === ""){
			retNotation = "0";
		}
		return retNotation;
	};

	/**
	 *  Convert a notation value to the current units
	 *  @param  {Notation}  notation
	 *  @return  {Number}
	 *  @private
	 */
	Tone.Time.prototype._notationToUnits = function(notation){
		var primaryExprs = this._expressions;
		var notationExprs = [primaryExprs.n, primaryExprs.t, primaryExprs.m];
		for (var i = 0; i < notationExprs.length; i++){
			var expr = notationExprs[i];
			var match = notation.match(expr.regexp);
			if (match){
				return expr.method.call(this, match[1]);
			}
		}
	};

	/**
	 *  Return the time encoded as Bars:Beats:Sixteenths.
	 *  @return  {BarsBeatsSixteenths}
	 */
	Tone.Time.prototype.toBarsBeatsSixteenths = function(){
		var quarterTime = this._beatsToUnits(1);
		var quarters = this.toSeconds() / quarterTime;
		var measures = Math.floor(quarters / this._getTimeSignature());
		var sixteenths = (quarters % 1) * 4;
		quarters = Math.floor(quarters) % this._getTimeSignature();
		sixteenths = sixteenths.toString();
		if (sixteenths.length > 3){
			// the additional parseFloat removes insignificant trailing zeroes
			sixteenths = parseFloat(parseFloat(sixteenths).toFixed(3));
		}
		var progress = [measures, quarters, sixteenths];
		return progress.join(":");
	};

	/**
	 *  Return the time in ticks.
	 *  @return  {Ticks}
	 */
	Tone.Time.prototype.toTicks = function(){
		var quarterTime = this._beatsToUnits(1);
		var quarters = this.toSeconds() / quarterTime;
		return Math.round(quarters * this._getPPQ());
	};

	/**
	 *  Return the time in samples
	 *  @return  {Samples}
	 */
	Tone.Time.prototype.toSamples = function(){
		return this.toSeconds() * this.context.sampleRate;
	};

	/**
	 *  Return the time as a frequency value
	 *  @return  {Frequency}
	 *  @example
	 * Tone.Time(2).toFrequency(); //0.5
	 */
	Tone.Time.prototype.toFrequency = function(){
		return 1/this.toSeconds();
	};

	/**
	 *  Return the time in seconds.
	 *  @return  {Seconds}
	 */
	Tone.Time.prototype.toSeconds = function(){
		return this.valueOf();
	};

	/**
	 *  Return the time in milliseconds.
	 *  @return  {Milliseconds}
	 */
	Tone.Time.prototype.toMilliseconds = function(){
		return this.toSeconds() * 1000;
	};

	return Tone.Time;
});
