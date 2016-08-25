var express = require('express');
var cfenv = require('cfenv');
var path = require('path');
var fs = require('fs');
var app = express();

var CPU_SPIKE_PERIOD = 500;
var CPU_NUM_SPIKES = 60;
var cpuSpikeCount = 0;

var MEM_SPIKE_PERIOD = 500;
var MEM_NUM_SPIKES = 120;
var MEM_ALLOCATION_COUNT = 100; // Each allocation is 1MB, so 100 MB total
var memorySpikeCount = 0;
var memory_array = [];

// Keeps scheduling itself until we've reached the spike count.  During each invocation
// we just chew up CPU for the length of the period, so by the time we've finished chewing
// the timer should go off for the next period.
function doCpuWork(timeperiod) {
	cpuSpikeCount++;
	if (cpuSpikeCount < CPU_NUM_SPIKES) setTimeout(doCpuWork, CPU_SPIKE_PERIOD, CPU_SPIKE_PERIOD);

	var currenttime = new Date().getTime();
	var starttime = new Date().getTime();
	while (currenttime <= (starttime + timeperiod)) {
		Math.random() * Math.random();
		currenttime = new Date().getTime();
	}

	if (cpuSpikeCount >= CPU_NUM_SPIKES) {
		console.log("Completed cpu spike.");
	}
}

var readMemoryWasteFile = function() {
	var waste_file_path = '.' + path.sep + 'waste.file';
	var waste_data = fs.readFileSync(waste_file_path);
	return waste_data;
}

function doMemoryWork(timeperiod) {
	memorySpikeCount++;
	if (memorySpikeCount < MEM_NUM_SPIKES) setTimeout(doMemoryWork, MEM_SPIKE_PERIOD, MEM_SPIKE_PERIOD);

	if (memorySpikeCount >= MEM_NUM_SPIKES) {
		memory_array = [];
		if (global.gc) {
			global.gc();
		} else {
			console.log('Unable to force gc.');
		}
		console.log("Completed memory spike.");
	}
}

app.get('/', function (req, res) {
	var usage = `Sample app for testing hubot app alerts.  Available end-points:\
			\n\t/crash - crashes the app\
			\n\t/cpu - causes CPU to spike for ${(((CPU_SPIKE_PERIOD * 2) * CPU_NUM_SPIKES) / 1000)} seconds\
			\n\t/memory - causes memory to grow of ${MEM_ALLOCATION_COUNT}MB`;

	res.send(usage);
});

app.get('/crash', function(req,res) {
	console.log("Crashing the app");
	res.send({message: "CrashApp: Crashed!"});
	process.exit(1);
	console.log("The app should have crashed; oh well.");
});

app.get('/cpu', function(req,res) {
	console.log("Causing spike in cpu usage.");
	cpuSpikeCount = 0;
	setTimeout(doCpuWork, CPU_SPIKE_PERIOD, CPU_SPIKE_PERIOD);
	res.send({message: "CrashApp: Initiated "+(((CPU_SPIKE_PERIOD*2)*CPU_NUM_SPIKES)/1000)+" second CPU spike."});
});

app.get('/memory', function(req,res) {
	console.log("Causing spike in memory usage");
	memorySpikeCount = 0;

	// waste memory by reading in a 1MB file many times.
	for(var i = 0; i < MEM_ALLOCATION_COUNT; ++i) {
		memory_array.push(readMemoryWasteFile());
	}

	setTimeout(doMemoryWork, MEM_SPIKE_PERIOD, MEM_SPIKE_PERIOD);
	res.send({message: "CrashApp: Initiated "+((MEM_SPIKE_PERIOD*MEM_NUM_SPIKES)/1000)+" second memory spike of "+ MEM_ALLOCATION_COUNT+" MB."});
});

app.get('/clear', function(req,res) {
	console.log("Clearing spikes in cpu and memory usage");
	cpuSpikeCount = CPU_NUM_SPIKES;
	memorySpikeCount = MEM_NUM_SPIKES;
	console.log("Spikes in cpu and memory usage cleared; should happen within a half second or so");
	res.send({message: "CrashApp: Cleared CPU and memory spikes."});
});

// Get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();
var port = appEnv ? appEnv.port : 3000;
var url = appEnv ? appEnv.url : `http://localhost:${port}`;

app.listen(port, function() {
  console.log("Server starting on " + url);
});


