//[common]
(function () {
    'use strict';

/*
** support functions
*/
//
// left-pad a number with a specified number of leading zeroes
//
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