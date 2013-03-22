var visir = visir || {};

visir.InstrumentRegistry = function()
{
	this._instruments = [];
	this._registeredTypes = {
		circuit: 0,
		dcpower: 0,
		functiongenerator: 0,
		multimeter: 0,
		oscilloscope: 0
	};
	
	function InstrInfo(type, name, swf) { return { type: type, displayname: name, swf: swf } };
	this._instrumentInfo = {
		AgilentOscilloscope: InstrInfo("oscilloscope", "Oscilloscope", "oscilloscope/oscilloscope.swf")
		, Breadboard: InstrInfo("circuit", "Breadboard", "breadboard/breadboard.swf")
		, FlukeMultimeter: InstrInfo("multimeter", "Multimeter", "multimeter/multimeter.swf")
		, HPFunctionGenerator: InstrInfo("functiongenerator", "Function Generator", "functiongenerator/functiongenerator.swf")
		, NationalInstrumentOscilloscope: InstrInfo("oscilloscope", "Oscilloscope", "")
		, TripleDC: InstrInfo("dcpower", "Triple DC", "tripledc/tripledc.swf")
	}
}

visir.InstrumentRegistry.prototype._Reset = function()
{
	this._instruments = [];
	this._registeredTypes = {
		circuit: 0,
		dcpower: 0,
		functiongenerator: 0,
		multimeter: 0,
		oscilloscope: 0
	};
}

visir.InstrumentRegistry.prototype.CreateInstrument = function()
{
	function construct(constructor, args) {
		function F() {
			return constructor.apply(this, args);
		}
		F.prototype = constructor.prototype;
		return new F();
	}
	
	if (arguments.length < 2) throw "Invalid number of arguments to CreateInstrument";
	var name = arguments[0];
	var id = this._NextInstrID(name);
	arguments[0] = id; // replace the first argument with the id before passing them along.
	arguments[1] = $(arguments[1]); // get the jquery dom node
	var newinstr = construct(visir[name], arguments);
	
	var entry = { instrument: newinstr, id: id, domnode: arguments[1], instrInfo: this._instrumentInfo[name], name: name };
	this._instruments.push(entry);
	return newinstr;
}

visir.InstrumentRegistry.prototype._NextInstrID = function(name)
{
	//XXX: check the db for instr type and update the counts
	if (!this._instrumentInfo[name]) throw "Instrument name not found in InstrumentRegistry";
	return ++this._registeredTypes[this._instrumentInfo[name].type];
}

visir.InstrumentRegistry.prototype.WriteRequest = function()
{
	var out = "";
	for(var i=0;i<this._instruments.length; i++) {
		out += this._instruments[i].instrument.WriteRequest();
	}
	return out;
}

visir.InstrumentRegistry.prototype.ReadResponse = function(response)
{
	for(var i=0;i<this._instruments.length; i++) {
		this._instruments[i].instrument.ReadResponse(response);
	}
}

visir.InstrumentRegistry.prototype.ReadSave = function(response)
{
	for(var i=0;i<this._instruments.length; i++) {
		if (typeof (this._instruments[i].instrument.ReadSave) == "function") {
			this._instruments[i].instrument.ReadSave(response);
		}
	}
}

visir.InstrumentRegistry.prototype.WriteSave = function()
{
	$xml = $('<save version="2" />');
	var instrumentlist = "";
	for(var i=0;i<this._instruments.length; i++) {
		if (i>0) instrumentlist += "|";
		instrumentlist += this._instruments[i].name;
	}
	var $instruments = $('<instruments />').attr("htmlinstruments", instrumentlist);
	$xml.append($instruments);
	for(var i=0;i<this._instruments.length; i++) {
		if (typeof (this._instruments[i].instrument.WriteSave) == "function") {
			$xml.append(this._instruments[i].instrument.WriteSave());
		}
	}
	return $("<root />").append($xml).html();
}

visir.InstrumentRegistry.prototype.MakeRequest = function(transport)
{
	var me = this;
	transport.Request(this.WriteRequest(), function(res) { me.ReadResponse(res); } );
}

// XXX: don't know if this is going to stay here or in some other class
//

visir.InstrumentRegistry.prototype._CreateInstrContainer = function(type)
{
	var id = this._registeredTypes[type]+1;
	return $('<div class="instrument" id="' + type + id + '" />');
}

visir.InstrumentRegistry.prototype._CreateInstrFromSWF = function(swf, $loc)
{
	for (var key in this._instrumentInfo) {
		if (this._instrumentInfo[key].swf == swf) {
			var $ctnr = this._CreateInstrContainer(this._instrumentInfo[key].type);
			var newinstr = this.CreateInstrument(key, $ctnr);
			$loc.append($ctnr);
			return newinstr;
		}
	}
	return null;
}

visir.InstrumentRegistry.prototype.LoadExperimentFromURL = function(url, $loc, $buttons)
{
	var me = this;
	$.get(url, function(data) {
		me.LoadExperiment(data, $loc);
		me.CreateButtons($buttons);
		$loc.find("> .instrument").hide();
		$loc.find("> .instrument").first().show();
	});
}

visir.InstrumentRegistry.prototype.LoadExperiment = function(xmldata, $loc)
{
	$loc.find(".instrument").remove();
	this._Reset();
	var $xml = $(xmldata);
	var $instr = $xml.find("instruments");
	
	var flashlocs = $instr.attr("list");
	var swfs = flashlocs ? flashlocs.split("|") : [];
	
	for(var i=0;i<swfs.length; i++) {
		trace("creating instrument from swf: " + swfs[i]);
		this._CreateInstrFromSWF(swfs[i], $loc);
	}
	
	var htmlinstr = $instr.attr("htmlinstruments");
	var htmlarr = htmlinstr ? htmlinstr.split("|") : [];
	for(var i=0;i<htmlarr.length; i++) {
		trace("creating instrument from js name: " + htmlarr[i]);
		var $ctnr = this._CreateInstrContainer(this._instrumentInfo[htmlarr[i]].type);
		this.CreateInstrument(htmlarr[i], $ctnr);
		$loc.append($ctnr);
	}
	
	this.ReadSave($xml);
}

visir.InstrumentRegistry.prototype._CreateInstrButton = function(name)
{
	return $('<button class="instrumentbutton">' + name + '</button>');
}

visir.InstrumentRegistry.prototype.CreateButtons = function($container)
{
	$container.find(".instrumentbutton").remove();
	var me = this;
	
	function genButtonHandler($dom) {
		return function() {
			for(var i=0;i<me._instruments.length; i++) {
				me._instruments[i].domnode.hide();
			}
			$dom.show();
		}
	}
	
	for(var i=0;i<this._instruments.length; i++) {
		var instr = this._instruments[i];
		var suffix = "";
		if (this._instruments[i].id > 1) suffix += " " + this._instruments[i].id;
		var $newButton = this._CreateInstrButton( instr.instrInfo.displayname + suffix);
		$newButton.click( genButtonHandler(instr.domnode));
		$container.append($newButton);
	}
}