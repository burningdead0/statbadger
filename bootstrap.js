// ==UserScript==
// @name         Bootstrap COTG Alliance Stats
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  launch COTG Alliance Stats
// @author       bd
// @match        https://www.crownofthegods.com/home/
// @icon
// @grant       window.close
// @require     https://raw.githubusercontent.com/burningdead0/statbadger/master/common.js
// @updateURL   https://raw.githubusercontent.com/burningdead0/statbadger/master/bootstrap.js
// @downloadURL https://raw.githubusercontent.com/burningdead0/statbadger/master/bootstrap.js
// ==/UserScript==

(function() {
    'use strict';

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
        let match = cookie.match(/(\w+),([\d:\- ]+)$/);
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

        this.lastRun = new Timestamp(LAST_RUN_NEVER);
        //alert(this.lastRun);

        console.log(this.lastRun.toString()+ " :: " + this.state);
        console.log(this.startTime.toString());
        console.log(this.minTime.toString());
        console.log(this.maxTime.toString());

        if ( (this.startTime >= this.minTime) && (this.startTime <= this.maxTime) ) {
            //reset state of
            if ( this.lastRun < this.minTime ) {
                this.lastRun.setTime(this.startTime);
                this.state = WorkState.Ready;
                setCookie(WORK_COOKIE_NAME, this.toCookie(), 365)
                console.log(WORK_COOKIE_NAME + "=" + this.toCookie());
            }

            if ( this.state != WorkState.Finished ) {
                //reset state of worlds that were run prior to today
                for ( var i = 0; i < worlds.length; ++i ) {
                    var w = worlds[i];
                    //alert(`before ${w.worldNumber} ${w.state} ${typeof w.lastRun}.${typeof me.minTime} ${w.lastRun} > ${me.minTime}`);
                    if ( w.lastRun.getTime() < me.minTime.getTime() ) {
                        w.state = WorldState.Ready;
                        w.lastRun.setTime(this.lastRun);
                        //alert(`after ${worlds[i].worldNumber} ${worlds[i].state} ${worlds[i].lastRun}`);
                    }
                }

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
                    HomeUi.selectWorld(worlds,world.worldNumber,function(ws,wn,result) {
                        if ( result ) {
                            //alert("play " +wn);
                            //ws.getWorldByNumber(wn).state = WorldState.Finished;
                            //setCookie(WORLD_COOKIE_NAME,ws.toCookie(),365);
                            HomeUi.playSelectedWorld();
                        } else {
                            //alert("failed " & wn);
                            ws.getWorldByNumber(wn).state = WorldState.Failed;
                            setCookie(WORLD_COOKIE_NAME,ws.toCookie(),365);
                            window.location.reload()
                        }
                    });
                } else {
                    this.state = WorkState.Finished;
                    setCookie(WORK_COOKIE_NAME, this.toCookie(),365)
                    window.close();
                    //download finished file
                }
           }
         } else {
            console.log("outside run window")
        }
    }
}

class HomeUi {
    static getSelectedWorldNumber() { return parseInt(document.getElementById("selwrld").innerText.match(/^\w+ (\d+)$/)[1]) }
    static moveNextWorld() { document.getElementById("roundaboutcont").carousel.next() }
    static movePrevWorld() { document.getElementById("roundaboutcont").carousel.prev() }
    static playSelectedWorld() { document.getElementById("playthswrld").click(); }
    static selectWorld(worlds, worldNumber, fnResult, direction, previousIndex) {
        let left = true;
        let right = !left;

        //get reference to the carousel
        let car = document.getElementById("roundaboutcont").carousel;

        //
        // if the currently selected world in the carousel matches worldNumber, success
        // if the currently select world is greater than worldNumber, try and move the carousel to prev
        // if the currently select world is lesser than worldNumber, try and move the carousel to next
        //
        let currWorld = HomeUi.getSelectedWorldNumber();
        console.log("****");
        console.log(worldNumber);
        console.log(currWorld);
        console.log(previousIndex);
        console.log(car.current);
        console.log("****");

        if ( currWorld == worldNumber ) {
            //alert("found world "+worldNumber);

            console.log("found world "+worldNumber);
            fnResult(worlds, worldNumber, true);
        } else if ( currWorld > worldNumber ) {
            if ( (previousIndex !== car.current) && (direction === undefined || direction == left) ) {
                //alert("moving left "+worldNumber);

                previousIndex = car.current;
                car.prev();
                setTimeout(HomeUi.selectWorld, Math.floor(Math.random() * 1000)+2000, worlds, worldNumber, fnResult, left, previousIndex)
            } else {
                //alert("failed moving left "+worldNumber);
                fnResult(worlds, worldNumber,false);
            }
        } else if ( (previousIndex !== car.current) && (direction === undefined || direction == right) ) {
            //alert("moving right "+worldNumber);

            previousIndex = car.current;
            car.next();
            setTimeout(HomeUi.selectWorld, Math.floor(Math.random() * 1000)+2000, worlds, worldNumber, fnResult, right, previousIndex)
        } else {
            //alert("failed moving right "+worldNumber);

            fnResult(worlds, worldNumber, false);
        }
    }
}

$(document).ready(function () {
    setTimeout(function(){
        let work = WorkEngine.fromCookie(getCookie(WORK_COOKIE_NAME));
        work.execute();
    },Math.floor(Math.random() * 2000)+4000);

    //const result = findNodeByContent('World 23');
    //console.log(result);
  });

})();
