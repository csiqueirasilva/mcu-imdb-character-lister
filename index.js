var request = require('request');
var cheerio = require('cheerio');
var fse = require('fs-extra');
var csv = require('csv-stringify');
var fs = require('fs');

var baseURL = 'https://www.imdb.com';

var mcuProperties = JSON.parse(fs.readFileSync('mcu.json', 'utf8'));

function generateCSV(fname, list, fn) {
	
	const csvHeader = ['role', 'actorname', 'actorimdb', 'titlename', 'titleimdb'];
	const csvOptions = {header: true, columns: csvHeader, delimiter: ',', quoted: true};
	
	csv(list, csvOptions, function(errCsv, csvData) {
		fse.outputFile(fname, csvData, err => {
			if(err) {
				console.log(err);
			} else {
				console.log('generated: ' + fname);
				if(fn instanceof Function) {
					fn();
				}
			}
		});
	});
}

function removeIMDBRef (str, suffix) {
	if(!suffix) {
		suffix = '';
	}
	var removeEnd = /(?!.*\/)\?.*$/ig;
	return str.replace(removeEnd, '').slice(0, -1) + suffix;
}

function trim(str) {
	return str ? str.replace(/^\s*|\s*$/g, '').replace(/\s+/g, ' ') : undefined;
}

var globalList = [];

function fetchCastList() {
	var castList = mcuProperties.shift();
	if(castList) {
		var url = baseURL + castList.imdb + '/fullcredits';
		console.log('fetching ' + castList.name + ' (' + castList.date + '): ' + url);
		request(url, function(err, resp, html) {
			if(err) {
				console.log(err);
			} else {
				
				const $ = cheerio.load(html);
				var actors = [];
				var rows = $('table.cast_list tbody tr');
				var rowsSize = rows.length;

				for(var i = 0; i < rowsSize; i++) {
					var el = $(rows[i]);
					var actorIMDB = trim(el.find('td[itemprop=actor] a').attr('href'));
					var actorName = trim(el.find('td[itemprop=actor] a').text());
					var role = trim(el.find('td.character').text());
					actors.push({
						actorIMDB: actorIMDB,
						actorName: actorName,
						role: role
					});
				}
				
				var list = [];
				for(var i = 0; i < actors.length; i++) {
					if(actors[i].actorIMDB) {
						var actorIMDB = baseURL + removeIMDBRef(actors[i].actorIMDB);
						
						actors[i].actorname = actors[i].actorName;
						actors[i].actorimdb = actorIMDB;
						actors[i].titlename = castList.name;
						actors[i].titleimdb = baseURL + castList.imdb;
						
						delete actors[i].actorIMDB;
						delete actors[i].actorName;

						list.push(actors[i]);
					}
				}
				
				var fname = 'output/' + castList.date + '_' + castList.imdb.replace('/title/', '') + '.csv';
				
				generateCSV(fname, list, function() {
					globalList = globalList.concat(list);
					setTimeout(fetchCastList, 5000);
				});
			}
		});

	} else {
		var fname = 'output/full.csv';
		generateCSV(fname, globalList);
	}
}

fetchCastList();