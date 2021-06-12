// ==UserScript==
// @name         COTG Alliance Stats
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  retrieve alliance player stats
// @author       bd
// @match        https://w23.crownofthegods.com/
// @icon
// @grant        none
// @updateURL   https://raw.githubusercontent.com/burningdead0/statbadger/master/get_stats_axaj.js
// @downloadURL https://raw.githubusercontent.com/burningdead0/statbadger/master/get_stats_axaj.js
// ==/UserScript==
//[common]
const findNodeByContent = (text, root = document.body) => {
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    const nodeList = [];

    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode;

      if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(text)) {
        nodeList.push(node.parentNode);
      }
    };

    return nodeList;
}
(function () {
    'use strict';

/*
** support functions
*/
//
// left-pad a number with a specified number of leading zeroes
//
function formatZeroDigits(number, numDigits) {
    let zeroes = numDigits - number.toString().length;
    if ( zeroes > 0 ) { return "0".repeat(zeroes)+number }
    else { return number.toString() }
}
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
}

/*
** Work
*/
//start of time, window to try (hours) andmaximum tries
const WorkConfig = {
    WorldsInUse: [22,23],
    StartTime: {hour: 21, min: 0, sec: 0},
    NumHours: 5,
    MaxTries: 5
}; Object.freeze(WorkConfig);

const WorldState = {
    Ready: "ready",
    Running: "running",
    Failed: "failed",
    Finished: "finished"
}; Object.freeze(WorldState);

const WorkState = {
    Ready: "ready",
    Finished: "finished"
}; Object.freeze(WorkState);

//
const WORK_COOKIE_NAME = "bcas_work_state";
const WORLD_COOKIE_NAME = "bcas_world_state";
const COOKIE_VALUE_DELIM = ",";
const LAST_RUN_NEVER = "1980-01-01 00:00:00";
const NOT_TRIED = 0;
const COOKIE_WORLD_DELIM = "~";

//cookie format "bcas_work_state={state},{last_run}"
const WorkCookieIndex = {
    State: 0,
    LastRun: 1,
}; Object.freeze(WorkCookieIndex);

//cookie format "bcas_world_state={world#},{state},{last_run},{run_expiry},{tries}~"
const WorldCookieIndex = {
    WorldNumber: 0,
    State: 1,
    LastRun: 2,
    Tries: 3
}; Object.freeze(WorldCookieIndex);

class Timestamp extends Date {
    addHours(h) {
        return this.setTime(this.getTime() + (h*60*60*1000));
    }

    static fromString(timestamp) {
        console.log("Timestamp.fromString("+timestamp+")");
        let match = timestamp.match(/^(\d{4})\-(\d{2})\-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if ( match == null ) { throw "Invalid timestamp format." }
        return new Timestamp(match[1],match[2]-1,match[3],match[4],match[5],match[6])
    }

    toString() {
        return `${this.getFullYear()}-${formatZeroDigits(this.getMonth()+1,2)}-${formatZeroDigits(this.getDate(),2)}` +
                ` ${formatZeroDigits(this.getHours(),2)}:${formatZeroDigits(this.getMinutes(),2)}:${formatZeroDigits(this.getSeconds(),2)}`
    }
}

class WorldInfo {
    static fromCookieValue(cookieValue) {
        if ( !/^\d+,\w+,[\d:\- ]+,\d+$/.test(cookieValue) ) { return undefined }

        console.log(`Creating world from cookie ${cookieValue}`)
        let values = cookieValue.split(COOKIE_VALUE_DELIM);
        return new WorldInfo(values[WorldCookieIndex.WorldNumber],
                                values[WorldCookieIndex.State],
                                values[WorldCookieIndex.LastRun],
                                values[WorldCookieIndex.Tries])
    }
    toCookieValue() {
        return `${this.worldNumber}` + COOKIE_VALUE_DELIM +
                `${this.state}` + COOKIE_VALUE_DELIM +
                `${this.lastRun.toString()}` + COOKIE_VALUE_DELIM +
                `${this.tries}`
    }

    constructor(worldNumber, state, lastRun, tries) {
        this.worldNumber = worldNumber;
        this.state = (state !== undefined) ? state : WorldState.Ready;
        this.lastRun = (lastRun !== undefined) ? Timestamp.fromString(lastRun) : Timestamp.fromString(LAST_RUN_NEVER);
        this.tries = (tries !== undefined) ? tries : NOT_TRIED;
    }
}

class Worlds extends Array {
    static fromCookie(cookie) {
        let worldsInCookie = new Worlds;

        cookie.split(COOKIE_WORLD_DELIM).forEach( function(worldCookie) {
            let world = WorldInfo.fromCookieValue(worldCookie);
            if ( world !== undefined ) {
                worldsInCookie.push(world);
            }
        });
        return worldsInCookie;
    }

    toCookie() {
        let cookie = "";
        this.forEach( function(world) {
            if ( world != null ) {
                cookie += world.toCookieValue() + COOKIE_WORLD_DELIM;
            }
        });
        return cookie;
    }

    removeUnused(worldsInUse) {
        let me = this;

        for ( var worldIndex = this.length-1; worldIndex >= 0; --worldIndex ) {
            let findWorld = this[worldIndex];
            let found = false;

            worldsInUse.forEach( function(inUse) {
                if ( findWorld.worldNumber == inUse ) {
                    found = true;
                    return;
                }
            });

            if ( !found ) {
                console.log(`Removing world ${findWorld.worldNumber}`);
                let removedWorld = this.splice(worldIndex,1);
            }
        }
    }

    createInUse(worldsInUse) {
        let me = this;

        worldsInUse.forEach( function(inUse) {
            let found = false;
            for ( var worldIndex = 0; worldIndex < me.length; ++worldIndex ) {
                if ( me[worldIndex].worldNumber == inUse ) {
                    found=true;
                    break;
                }
            }
            if ( !found ) {
                console.log(`Creating world ${inUse}`)
                me.push(new WorldInfo(inUse));
            }
        });
    }

    getFirstByState(state) {
        for ( var i = 0; i < this.length; ++i ) {
            if ( this[i].state == state ) { return this[i] }
        }
        return undefined
    }

    getWorldByNumber(worldNumber) {
        for ( var i = 0; i < this.length; ++i ) {
            if ( this[i].worldNumber == worldNumber ) { return this[i] }
        }
    }
}
})();
//[/common]
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
/////////////////////////////////////////////////
const ActionQueueOrder = {
    Sequential: "sequential",
    Prereq: "prereq"
}; Object.freeze(ActionQueueOrder);

const ActionItemState = {
    Idle: "idle",
    Running: "running",
    Finished: "finished",
    Timeout: "timeout"
}; Object.freeze(ActionItemState);

const ActionQueueState = {
    Idle: "idle",
    Running: "running",
    Finished: "finished",
}; Object.freeze(ActionQueueState);

class ActionItem {
    constructor(id, fn, timeout) {
        this.id = id;
        this.fn = fn;
        this.state = ActionItemState.Idle;
        this.timeout = (isNaN(timeout) ? 0 : timeout);
    }
}

class ActionArgs {
    constructor(queue, id, timeoutId) {
        this.actionQueue = queue;
        this.actionId = id;
        this.timeoutId = timeoutId;
    }
    next() {
        this.actionQueue.next(this);
    }
}

class ActionQueue extends Array {
    constructor() {
        super();
        this.state = ActionQueueState.Idle;
        this.order = ActionQueueOrder.Sequential;
        this.nextId = 1;
        this.currentActionId = null;
    }
    stateChanged(actionQueue, prevState) {}

    static getActionById(id) {
        for ( var i = 0; i < this.length; ++i ) {
            if ( this[i].id == id ) {
                return this[i];
            }
        }
    }

    static actionTimeoutHandler(actionArgs) {
        let q = actionArgs.actionQueue;
        let action = ActionQueue.getActionById(actionArgs.id);
        action.state = ActionItemState.Timeout;
        actionArgs.timeoutId = null;
        q.next(actionArgs);
    }

    setState(state) {
        let from = this.state;
        this.state = state;
        this.stateChanged(this, from);
    }

    addAction(fn, timeout) {
        this[this.length] = new ActionItem(this.nextId++, fn, timeout);
    }

    performAction(action) {
        if ( action.state == ActionItemState.Idle ) {
            this.setState(ActionQueueState.Running);
            let args = new ActionArgs(this,action.id,null);
            action.state = ActionItemState.Running;
            console.log(`starting ${args.actionId}`);
            setTimeout(action.fn, 1, args);
            args.timeoutId = (action.timeout > 0) ? setTimeout(ActionQueue.actionTimeoutHandler,action.timeout,args) : null;
        }
    }

    finishAction(actionArgs) {
        if ( actionArgs.timeoutId != null ) {
            clearTimeout(actionArgs.timeoutId);
            actionArgs.timeoutId = null;
        }
    }

    first() {
        if ( this.length > 0 ) {
            this.performAction(this[0]);
        }
    }

    next(actionArgs) {
        this.finishAction(actionArgs);

        let nextAction = null;
        for ( var i = 0; i < this.length-1; ++i ) {
            if ( this[i].id == actionArgs.actionId ) {
                if ( this[i].state == ActionItemState.Running ) {
                    this[i].state = ActionItemState.Finished;
                    this.finishAction(this[i]);
                    nextAction = this[++i];
                }
                break;
            }
        }
        if ( nextAction != null ) {
            this.performAction(nextAction);
        } else {
            this.setState(ActionQueueState.Finished);
        }
    }
}

function callback1(o) {
    console.log("callback1");
    o.next();
}

function callback2(o) {
    console.log("callback2");
    o.next();
}

function callback3(o) {
    console.log("callback3");
    o.next();
}

function aq_state_changed() {

}

$(document).ready(function () {
    let aq = new ActionQueue();
    aq.stateChanged = function(q, prevState) { console.log(`queue state = ${q.state}`) };
    aq.addAction(callback1);
    aq.addAction(callback2);
    aq.addAction(callback3);
    aq.first();

    var copyStatsBtn="<button id='getMemberStats' style='right: 35.6%; margin-top: 5px;width: 150px;height: 30px !important; font-size: 12px !important; position: absolute;' class='regButton greenb'>Copy Stats</button>";
    var rankingsDivTitle = $("#rankingsPopUpBox > .ppbwincontent > .popUpBar");
    rankingsDivTitle.append(copyStatsBtn);
    $('#getMemberStats').click(function() { getMemberStatsClick() });
});

})();
