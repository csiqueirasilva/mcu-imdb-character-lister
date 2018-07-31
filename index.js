var scavenger = require('scavenger');
var fse = require('fs-extra');
var csv = require('csv-stringify');
var fs = require('fs');
var Fuse = require('fuse-js-latest'); /* search to try to reduce results NYI */

var baseURL = 'https://www.imdb.com';

var mcuProperties = JSON.parse(fs.readFileSync('mcu.json', 'utf8'));

function removeIMDBRef (str, suffix) {
	if(!suffix) {
		suffix = '';
	}
	var removeEnd = /(?!.*\/)\?.*$/ig;
	return str.replace(removeEnd, '').slice(0, -1) + suffix;
}	

var globalList = [];

const extractActorRoles = scavenger.createExtractor({
	scope: 'table.cast_list tbody tr',
	fields: {
		actorIMDB: {
			selector: 'td[itemprop=actor] a',
			attribute: 'href'
		},
		actorName: 'td[itemprop=actor] a',
		role: 'td.character'
	}
});

const csvHeader = ['role', 'actorname', 'actorimdb', 'titlename', 'titleimdb'];
const csvOptions = {header: true, columns: csvHeader, delimiter: ';', quoted: true};

function fetchCastList() {
	var castList = mcuProperties.shift();
	if(castList) {
		var url = baseURL + castList.imdb + '/fullcredits';
		console.log('fetching ' + castList.name + ' (' + castList.date + '): ' + url);
		scavenger.scrape(url, extractActorRoles)
			.then(function (actors) {
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
				
				csv(list, csvOptions, function(errCsv, csvData) {
					
					if(errCsv) {
						console.log(errCsv);
					} else {
						fse.outputFile(fname, csvData, err => {
							if(err) {
								console.log(err);
							} else {
								console.log('generated: ' + fname);
								globalList = globalList.concat(list);
								setTimeout(fetchCastList, 15000);
							}
						});
					}
				});
			});
	} else {
		var fname = 'output/full.csv';

		csv(globalList, csvOptions, function(errCsv, csvData) {
			fse.outputFile(fname, csvData, err => {
				if(err) {
					console.log(err);
				} else {
					console.log('generated: ' + fname);
				}
			});
		});
	}
}

fetchCastList();