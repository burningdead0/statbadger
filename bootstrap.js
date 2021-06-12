// ==UserScript==
// @name         Bootstrap COTG Alliance Stats
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  launch COTG Alliance Stats
// @author       bd
// @match        https://www.crownofthegods.com/home/
// @icon
// @grant        none
// @updateURL https://raw.githubusercontent.com/burningdead0/cotg/master/bootstrap_get_stats.js
// @downloadURL https://raw.githubusercontent.com/burningdead0/cotg/master/bootstrap_get_stats.js
// ==/UserScript==

(function() {
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
    WorldsInUse: [1,2,3,4,5,23,29,30,31,32],
    StartTime: {hour: 17, min: 0, sec: 0},
    NumHours: 1,
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
        return new Timestamp(match[1],match[2],match[3],match[4],match[5],match[6])
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
        this.lastRun = (lastRun !== undefined) ? lastRun : Timestamp.fromString(LAST_RUN_NEVER);
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
}

class WorkEngine {
    constructor(state, lastRun) {
        if ( state === undefined && lastRun === undefined ) {
            this.state = WorkState.Ready;
            this.lastRun = Timestamp.fromString(LAST_RUN_NEVER);
        } else {
            this.state = state;
            this.lastRun = Timestamp.fromString(lastRun);
        }

        this.startTime = new Timestamp();
        this.minTime = new Timestamp();
        this.minTime.setHours(WorkConfig.StartTime.hour,
                                WorkConfig.StartTime.min,
                                WorkConfig.StartTime.sec,
                                0);
        this.maxTime = new Timestamp(this.minTime.getTime());
        this.maxTime.addHours(WorkConfig.NumHours);

        this.worlds = Worlds.fromCookie(getCookie(WORLD_COOKIE_NAME));
        this.worlds.removeUnused(WorkConfig.WorldsInUse);
        this.worlds.createInUse(WorkConfig.WorldsInUse);
    }

    static fromCookie(cookie) {
        let match = cookie.match(/^\w+,[\d:\- ]+$/);
        if ( match != null ) {
            return new WorkEngine(match[1],match[2])
        } else {
            return new WorkEngine()
        }
    }

    toCookie() {
        return this.state + COOKIE_VALUE_DELIM +
               this.lastRun
    }

    execute() {
        let me = this;
        let worlds = this.worlds;

        console.log(this.lastRun.toString());
        console.log(this.startTime.toString());
        console.log(this.minTime.toString());
        console.log(this.maxTime.toString());

        if ( (this.startTime >= this.minTime) && (this.startTime <= this.maxTime) ) {
            //reset state of
            if ( this.lastRun < this.minTime ) {
                this.lastRun = this.startTime;
                this.state = WorkState.Ready;
                setCookie(WORK_COOKIE_NAME, this.toCookie(), 365)
                console.log(WORK_COOKIE_NAME + "=" + this.toCookie());
            }

            if ( this.state != WorkState.Finished ) {
                //reset state of worlds that were run prior to today
                worlds.filter(world => (world.lastRun < this.minTime)).forEach( function(world) {
                    world.state = WorldState.Ready;
                    world.lastRun = me.startTime;
                });

                // first see if there is a running world and if it has exceeded tries
                let world = worlds.getFirstByState(WorldState.Running);
                if ( world !== undefined ) {
                    if ( world.tries >= WorkConfig.MaxTries ) {
                        world.state = WorldState.Failed;
                        world = undefined; // move on to the next
                    }
                }

                // find the next ready world
                if ( world === undefined ) { world = worlds.getFirstByState(WorldState.Ready) }
                if ( world !== undefined ) {
                    ++world.tries;
                    world.state = WorldState.Running;
                }

                // save state
                setCookie(WORLD_COOKIE_NAME,worlds.toCookie(),365);

                if ( world !== undefined ) {
                    // select world in carousel
                    //... todo

                    // play world
                    //playSelectedWorld();
                    world.state = WorldState.Finished;
                    setCookie(WORLD_COOKIE_NAME,worlds.toCookie(),365);

                } else {
                    this.state = WorkState.Finished;
                    setCookie(WORK_COOKIE_NAME, this.toCookie(),365)
                }
           }
         } else {
            console.log("bootstrap outside run window")
        }
    }
}

/*
** Determine
*/
function playSelectedWorld() { document.getElementById("#playthswrld").click(); }


$(document).ready(function () {
    let work = WorkEngine.fromCookie(getCookie(WORK_COOKIE_NAME));
    work.execute();
});

})();
