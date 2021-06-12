// ==UserScript==
// @name         COTG Alliance Stats
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  retrieve alliance player stats
// @author       bd
// @match        https://w23.crownofthegods.com/
// @icon
// @grant        none
// ==/UserScript==

(function() {
    'use strict';


    // Your code here...

//replace with alliance name
//const ALLIANCE_NAME = 'Goon Squad';

const CSV_PLAYERNAME = 0,
      CSV_SCORE = CSV_PLAYERNAME+1,
      CSV_CITIES = CSV_SCORE+1,
      CSV_MILTOTAL = CSV_CITIES+1,
      CSV_MILOFF = CSV_MILTOTAL+1,
      CSV_MILDEF = CSV_MILOFF+1,
      CSV_REP = CSV_MILDEF+1,
      CSV_REPOFF = CSV_REP+1,
      CSV_REPDEF = CSV_REPOFF+1,
      CSV_UNITKILLS = CSV_REPDEF+1,
      CSV_PLUNDERED = CSV_UNITKILLS+1,
      CSV_RAIDING = CSV_PLUNDERED+1;

const LINEBREAK = '\r\n';
const COMMA = '\t';
const DBL_QT = '"';

//ids for Rankings pop up
let membersTab = [
    {
        divId: 'playerRankingstab',
        tableId: 'playerRankingst',
        procAllianceMembers,
        cols: [{colName: 'Name', colNumber: 1}, {colName: 'Alliance', colNumber: 3}]
    } ];

let rankings = [
    {
        divId: 'playerRankingstab',
        tableId: 'playerRankingst',
        procTable,
        cols: [{colName: 'Score', colNumber: 2, csvCol: CSV_SCORE}, {colName: 'Cities', colNumber: 4, csvCol: CSV_CITIES}]
    },
    {
        divId: 'militaryRankingstab',
        tableId: 'totMilRankingst',
        procTable,
        cols: [{colName: 'MilTotal', colNumber: 2, csvCol: CSV_MILTOTAL}]
    },
    {
        divId: 'offenseRankingstab',
        tableId: 'offMilRankingst',
        procTable,
        cols: [{colName: 'MilOff', colNumber: 2, csvCol: CSV_MILOFF}]
    },
    {
        divId: 'defenseRankingstab',
        tableId: 'defMilRankingst',
        procTable,
        cols: [{colName: 'MilDef', colNumber: 2, csvCol: CSV_MILDEF}]
    },
    {
        divId: 'reputationRankingstab',
        tableId: 'reputationRankingst',
        procTable,
        cols: [{colName: 'Rep', colNumber: 3, csvCol: CSV_REP}]
    },
    {
        divId: 'offensiveReputationRankingstab',
        tableId: 'offensiveReputationRankingst',
        procTable,
        cols: [{colName: 'RepOff', colNumber: 3, csvCol: CSV_REPOFF}]
    },
    {
        divId: 'defensiveReputationRankingstab',
        tableId: 'defensiveReputationRankingst',
        procTable,
        cols: [{colName: 'RepDef', colNumber: 3, csvCol: CSV_REPDEF}]
    },
    {
        divId: 'unitsDefeatedRankingstab',
        tableId: 'unitsDefeatedRankingst',
        procTable,
        cols: [{colName: 'UnitKills', colNumber: 3, csvCol: CSV_UNITKILLS}]
    },
    {
        divId: 'pillagingRankingstab',
        tableId: 'pillagingRankingst',
        procTable,
        cols: [{colName: 'Plundered', colNumber: 3, csvCol: CSV_PLUNDERED}]
    },
    {
        divId: 'dungRankingstab',
        tableId: 'dungRankingst',
        procTable,
        cols: [{colName: 'Raiding', colNumber: 3, csvCol: CSV_RAIDING}]
    } ];

let memberStats = [];

//
//get text value of element
//
function getTextValue(obj)
{
    if ( obj.textContent ) {
        return obj.textContent;
    } else if ( obj.innerText ) {
        return obj.innerText;
    } else if ( obj.innerHTML ) {
        return obj.innerHTML;
    }
    return '';
}

//
//get cell value
//
function getCellValue(tr, cellNum) {
    let txt = '';
    let cell = tr.cells[cellNum];

    if ( cell.childNodes.length != 0 ) {
        for ( var n = 0; n < cell.childNodes.length; ++n ) {
            txt += getTextValue(cell.childNodes[n]);
        }
    }
    else {
        txt = getTextValue(cell);
    }
    return txt;
}

//
//Get an array of objects containing all members within an alliance
//
function procAllianceMembers(t) {
    let thisPlayerName = getTextValue(document.getElementById("playerName"));
    let allianceName = "";

    memberStats = [];
    let playerRows = document.getElementById(t.tableId).tBodies[0].rows;

    //get current player's alliance name
    for ( var r = 0; r < playerRows.length; ++r ) {
        let player = playerRows[r];
        if ( getCellValue(player,t.cols[0].colNumber) == thisPlayerName ) {
            allianceName = getCellValue(player,t.cols[1].colNumber);
            break;
        }
    }

    //get players in the alliance
    for ( r = 0; r < playerRows.length; ++r ) {
        let player = playerRows[r];
        if ( getCellValue(player,t.cols[1].colNumber) == allianceName ) {
            memberStats.push({playerName: getCellValue(player,t.cols[0].colNumber), stats: []});
        }
    }
    memberStats = memberStats.sort( function (a,b) {
        if ( a.playerName == b.playerName ) { return 0 }
        else { return (a.playerName.toLowerCase() > b.playerName.toLowerCase()) ? 1 : -1;
        }} );
}

//
//get one or more elements from a table row that belongs to a player
function procTable(m,t) {
    const NAME_COL = 1;

    let playerRowsTable = document.getElementById(t.tableId);
    if ( playerRowsTable ) { var playerRows = playerRowsTable.tBodies[0].rows; }
    if ( playerRows ) {
        for ( var r = 0; r < playerRows.length; ++r ) {
            let playerData = playerRows[r];

            if ( getCellValue(playerData, NAME_COL) == m.playerName ) {

                for ( var statCol = 0; statCol < t.cols.length; ++statCol ) {
                    m.stats[t.cols[statCol].csvCol] = getCellValue(playerData, t.cols[statCol].colNumber);
                }

                break;
            }
        }
    }
}

//
// get stats for all members in an alliance
//
function getAllianceStats() {
    procAllianceMembers(membersTab[0]);
    for ( var n = 0; n < memberStats.length; ++n ) {
        let player = memberStats[n];
        for ( var statNum = 0; statNum < statTabs.length; ++statNum ) {
            let stat = statTabs[statNum];
            procTable(player, stat);
        }
    }
}

//
// csv=friendly output. commas removed from numbers, strings are quoted
//
function getCsvOutputValue(v, undefinedValue, formatAsNumber ) {
    if (typeof v == 'undefined' ) { return undefinedValue }
    else if ( formatAsNumber == true ) { return parseInt(v.replace(/\,/g,'')) }
    else { return DBL_QT + v + DBL_QT }
}

//
// get column delimiter. Last column will use a line break
//
function getColumnDelim(currentCol, numCols) { return (currentCol < numCols-1) ? COMMA : LINEBREAK }

//
// left-pad a number with a specified number of leading zeroes
//
function formatZeroDigits(number, numDigits) {
    let zeroes = numDigits - number.toString().length;
    if ( zeroes > 0 ) { return "0".repeat(zeroes)+number }
    else { return number.toString() }
}

//
// simple string formatting: {0} .. {n} in fmt are substituted with passed arguments
// not my code
//
function format(fmt, ...args) {
    if (!fmt.match(/^(?:(?:(?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{[0-9]+\}))+$/)) {
        throw new Error('invalid format string.');
    }
    return fmt.replace(/((?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{([0-9]+)\})/g, (m, str, index) => {
        if (str) {
            return str.replace(/(?:{{)|(?:}})/g, m => m[0]);
        } else {
            if (index >= args.length) {
                throw new Error('argument index is out of range in format');
            }
            return args[index];
        }
    });
}

//
// download a text file
//
function download(filename, textInput) {    
    document.createElement('a');    
    element.setAttribute('href','data:text/plain;charset=utf-8, ' + encodeURIComponent(textInput));
    element.setAttribute('download', filename);
    document.body.appendChild(element);
    element.click();
    //element.remove
}

//
// convert member stats scraped from the COTG app to a csv
//
function allianceStatsToCsv()
{
    let output = '';

    //build array of csv column names
    let csvColNames = ['Name'];
    for ( var statNum = 0; statNum < statTabs.length; ++statNum ) {
        let stat = statTabs[statNum];
        for ( var statCol = 0; statCol < stat.cols.length; ++statCol ) {
            csvColNames[stat.cols[statCol].csvCol] = stat.cols[statCol].colName;
        }
    }

    //create header
    for ( var csvCol = 0; csvCol < csvColNames.length; ++csvCol ) {
        output += getCsvOutputValue(csvColNames[csvCol],'')+getColumnDelim(csvCol,csvColNames.length);
    }

    //generate player data
    for ( var n = 0; n < memberStats.length; ++n ) {
        let player = memberStats[n];
        output += getCsvOutputValue(player.playerName, '')+COMMA;

        for ( csvCol = 1; csvCol < csvColNames.length; ++csvCol ) {
            output += getCsvOutputValue(player.stats[csvCol],0,true)+getColumnDelim(csvCol,csvColNames.length);
        }
    }

    //download the csv
    let today = new Date();
    let csvFilename = format("cotg_player_stats_{0}-{1}-{2}.txt",today.getFullYear(),
                                                                 formatZeroDigits(today.getMonth()+1,2),
                                                                 formatZeroDigits(today.getDate(),2));
    download(csvFilename, output);
}

//
//
//
function getMemberStatsClick()
{
    getAllianceStats();
    allianceStatsToCsv();
}

/*
**$(document).ready(function () { getMemberStatsClick() });
return;
*/


$(document).ready(function () {
    var copyStatsBtn="<button id='getMemberStats' style='right: 35.6%; margin-top: 5px;width: 150px;height: 30px !important; font-size: 12px !important; position: absolute;' class='regButton greenb'>Copy Stats</button>";
    var rankingsDivTitle = $("#rankingsPopUpBox > .ppbwincontent > .popUpBar");
    rankingsDivTitle.append(copyStatsBtn);
    $('#getMemberStats').click(function() { getMemberStatsClick() });
});

})();
