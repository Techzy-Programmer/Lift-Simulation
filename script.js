(() => { // Closure to prevent functions & variables from being accessed by console or window object!
    let queue = new Set();
    let speedFactor = 4;
    let floorHeight = 0;
    let maxFloorNo = 0;
    let animSpeed = 0;
    let floorMap = {}; // properties: occupied, callable, el
    let liftMap = {}; // properties: busy, where, at(Current position in Y-Axis), goingUP, stops, el, id

    const colors = {
        yellow: "#ebff001f", // Represents a stop
        orange: "#ff61001f", // Represents the final stop
        blue: "#00ffba14", // Represents an idle floor
        red: "#ff00ac1f" // Represents a waiting floor
    };
    
    document.querySelector('.settings button.rst').addEventListener('click', resetSimulation);
    document.querySelector('.settings button.gen').addEventListener('click', addLevels);
    const buildingEl = document.querySelector('.apartment > .building');
    const speedEl = document.querySelector('#speed-data > input');
    const floorEl = document.querySelector('#floor-data > input');
    const liftEl = document.querySelector('#lift-data > input');
    resetSimulation();
    floorEl.focus();

    // #region Testing Zone

    /**
     * Sets the 'busy' property of one or more lifts to true.
     * If no argument is provided, it sets the 'busy' property of all lifts to true.
     * @note Meant only for testing puposes, this could have unexpected behaviour on application if not used properly!
     * @param {Array} lifts - An optional array of lift IDs.
    */
    function engageLifts(lifts) {
        const engAll = typeof lifts === 'undefined';
        let liftsEngd = 0;

        for (const lift of Object.entries(liftMap))
            if (!lift[1].busy && (engAll || (Array.isArray(lifts)
                && lifts.includes(lift[1].id)))) {
                    lift[1].busy = true;
                    liftsEngd++;
                }

        if (liftsEngd > 0) log(`${liftsEngd} lifts engaged!`)
        else log("Unable to engage lifts!", 'w');
    }

    /**
     * Sets the 'busy' property of one or more lifts to false.
     * If no argument is provided, it sets the 'busy' property of all lifts to false.
     * @note Meant only for testing puposes, this could have unexpected behaviour on application if not used properly!
     * @param {Array} [lifts] - An optional array of lift ids to disengage. If not provided, all lifts will be made free.
    */
    function disEngageLifts(lifts) {
        const disEngAll = typeof lifts === 'undefined';
        let liftsDisEngd = 0;

        for (const lift of Object.entries(liftMap))
            if (lift[1].busy && (disEngAll || (Array.isArray(lifts)
                && lifts.includes(lift[1].id)))) {
                    lift[1].busy = false;
                    liftsDisEngd++;
                }

        if (liftsDisEngd > 0) log(`${liftsDisEngd} lifts dis-engaged!`)
        else log("Unable to dis-engage lifts!", 'w');
    }

    window.engageLifts = engageLifts;
    window.disEngageLifts = disEngageLifts;
    window.processQueue = executeFromQueue;

    // #endregion

    // #region Utilities Function

    /**
     * Logs a message to the console.
     * @param {string} msg - The message to be logged.
     * @param {string} [type='i'] - The type of log. Available ('i' | 'w' | 't', 'e')
     * @returns {undefined}
    */
    function log(msg, type = 'i') {
        let logger = console.log;

        switch (type) {
            case 'w': logger = console.warn; break;
            case 't': logger = console.table; break;
            case 'e': logger = console.error; break;
        }

        logger(msg);
    }

    /**
     * Clones and returns a specific element from the HTML template based on the provided `elType` parameter.
     * @param {string} elType - The type of element to clone.
     * @returns {Element} - The cloned element.
    */
    function getCloned(elType) {
        switch (elType) {
            case 'level': return document.querySelector('#template > div.level').cloneNode(true);
            case 'floor': return document.querySelector('#template > div.floor').cloneNode(true);
            case 'lift': return document.querySelector('#template > div.lift').cloneNode(true);
            default: return document.querySelector('#template').cloneNode(true);
        }
    }

    /**
     * Calculates the vertical distance between the starting floor (floor 0) and the specified destination floor.
     * @param {number} to - The floor number to which the distance needs to be calculated.
     * @returns {number} - The vertical distance between the two floors.
    */
    function calcYDistance(to) {
        const fromYCord = document.querySelector(`.building .floor.flr-0`).getBoundingClientRect().y;
        const toYCord = document.querySelector(`.building .floor.flr-${to}`).getBoundingClientRect().y;
        const displacement = Math.abs(fromYCord - toYCord);
        const fct = 10000;
        const finalDisp = parseInt(displacement * fct) / fct;
        return (-1 * finalDisp);
    }

    /**
     * Executes pending lift requests from the queue.
     * If there are any pending requests in the queue, it calls the `callLift` function to handle the request.
    */
    function executeFromQueue() {
        if (queue.size > 0)
            callLift(-1, true);
    }

    /**
     * Adds a new stop to the lift's stops list,
     * sorts it according to the direction of lift and updates the floor appearance.
     * @param {Object} lift - The lift object.
     * @param {number} to - The floor number to add as a new stop.
     * @returns {boolean} - Returns true after the new stop has been added successfully.
    */
    function addNewStop(lift, to) {
        // Add & sort the lift stops
        const lvlEl = floorMap[to].el.parentElement;
        lift.stops.push({ f: to, y: calcYDistance(to) });
        lift.stops.sort((a, b) => lift.goingUP ? b.y - a.y : a.y - b.y);
        lvlEl.style.setProperty('--lvl-bg-clr', colors.yellow);
        floorMap[to].callable = false;
        return true;
    }

    /**
     * Resets the simulation by clearing the building element, resetting the queue,
     * and resetting the floor and lift maps.
    */
    function resetSimulation() {
        buildingEl.innerHTML = "";
        queue = new Set();
        speedFactor = 4;
        floorMap = {};
        liftMap = {};
    }

    /**
     * Returns the appropriate suffix for a given number.
     * 
     * @param {number} num - The input number.
     * @returns {string} - The suffix for the number.
    */
    function getNth(num) {
        return ["st", "nd", "rd"]
            [(((num < 0 ? -num : num) + 90)
                % 100 - 10) % 10 - 1] || "th"
    }

    /**
     * Calculates the refresh rate of the user's screen by measuring the time it takes to render two consecutive frames.
     * @returns {Promise<number>} The refresh rate of the user's screen in frames per second.
    */
    async function getScreenRefreshRate() {
        const getFPS = () => new Promise(res =>
            requestAnimationFrame(t1 => // Get 1st frame
                requestAnimationFrame(t2 => res(1000 / (t2 - t1))) // Get 2nd frame
            )
        );

        let it = 4, sum = 0;
        for (let i = 0; i < it; i++)
            sum += await getFPS();
        return Math.round(sum / it);
    }

    // #endregion

    /**
     * Animates the movement of a lift with it's door.
     * @param {Object} lift - The lift object to be animated.
     * @param {boolean} [travel=true] - Indicates whether the lift should actually travel or just open/close its doors.
     * @param {number} [to=0] - The floor number to which the lift should travel.
     * @returns {boolean} - Returns true if the animation can be started vertically, false otherwise.
    */
    function animateLift(lift, travel = true, to = 0) {
        const events = ['animationend', 'transitionend'];
        const levelEl = floorMap[to].el.parentElement;
        const yDisplacement = calcYDistance(to);
        if (lift.busy) return false;
        const from = lift.where;
        lift.goingUP = from < to;
        lift.busy = true;

        function animateDoor(isfinal = false, stopFloor = 0) {
            const handleAnimEnd = () => {
                lift.el.removeEventListener(events[0], handleAnimEnd);
                lift.el.classList.remove('anim');
                
                if (isfinal) {
                    if (travel) {
                        lift.where = to;
                        lift.at = yDisplacement;
                    }

                    lift.busy = false;
                    executeFromQueue();
                }
                else {
                    floorMap[stopFloor].el.parentElement.style.setProperty('--lvl-bg-clr', colors.blue);
                    floorMap[stopFloor].callable = true;
                    trackAndTravelInY();
                }
            };
            
            setTimeout(() => {
                lift.el.classList.add('anim');
                lift.el.addEventListener(events[0], handleAnimEnd);
            }, 50);

            if (isfinal && travel) {
                floorMap[to].callable = true;
                levelEl.style.setProperty('--lvl-bg-clr', colors.blue);
                lift.el.style.transform = `translateY(${yDisplacement}px)`; // Rectify Y-Coord of lift on last stop
            }
        }

        if (!travel) {
            animateDoor(true);
            return false;
        }
        
        let speedDelta = (lift.goingUP ? -1 : 1) * animSpeed * speedFactor;
        const limit = yDisplacement - speedDelta;
        const initialTYVal = lift.at;
        const prevPos = lift.at;
        let curTYVal = 0;

        // Implemented custom animation logic so as to track positions of lift
        async function trackAndTravelInY() {
            curTYVal += speedDelta;
            lift.at = initialTYVal + curTYVal;
            const stopLimit = lift.at + speedDelta;
            lift.el.style.transform = `translateY(${lift.at}px)`;
            // console.log({ prevPos, at: lift.at, curTYVal, limit, up: lift.goingUP });
            
            for (const eachStop of lift.stops) {
                if (lift.goingUP ? eachStop.y >=
                    stopLimit : eachStop.y <= stopLimit) {
                    animateDoor(false, eachStop.f);
                    const stopIdx = lift.stops.indexOf(eachStop);
                    if (stopIdx > -1) lift.stops.splice(stopIdx, 1); return;
                }
            }
            
            if ((lift.goingUP ? ((curTYVal + prevPos) <= limit)
                : ((curTYVal + prevPos) >= limit)))
                return animateDoor(true);

            // Built-in function for smooth animation
            requestAnimationFrame(trackAndTravelInY);
        }

        levelEl.style.setProperty('--lvl-bg-clr', colors.orange);
        trackAndTravelInY();
        lift.goingTo = to;
        return true;
    }

    /**
     * Returns the lift that is closest to the specified floor.
     * @param {number} of - The floor number.
     * @param {Array} inLifts - An array of lift objects.
     * @returns {Object|null} - The lift object that is closest to the specified floor, or null if no lifts are available.
    */
    function getLiftInProximity(of, inLifts) {
        if (inLifts.length === 0) return null;
        let nextLift = inLifts[0];
        let nearestDelta = maxFloorNo + 1;

        for (const liftDets of inLifts) {
            const curDelta = Math.abs(of - liftDets.where);

            if (curDelta < nearestDelta) {
                nextLift = liftDets;
                nearestDelta = curDelta;
            }
        }

        return nextLift;
    }

    /**
     * Calls and animates the lifts in a simulated building.
     * 
     * @param {number} floorNo - The floor number where the lift is being called to.
     * @param {boolean} fromQueue - Indicates if the call is from the queue.
     * @returns {boolean} - True if a lift is successfully called or added as a stop, false otherwise.
    */
    function callLift(floorNo, fromQueue = false) {
        const liftArr = Object.values(liftMap); // Array of lifts

        if (fromQueue) {
            const dirMap = {};
            const liftToFloors = new Map();
            const queueEntries = [...queue];
            queueEntries.sort((f, s) => (f - s));
            const freeLifts = liftArr.filter(lp => !lp.busy);
            
            // Time-Complexity O(L[free-lifts] * F[queued-floors])
            for (let i = 0; i < queueEntries.length; i++) { // O(F)
                const qdFloor = queueEntries[i]; // retrieve queued floor
                const nearLift = getLiftInProximity(qdFloor, freeLifts); // O(L)
                if (nearLift === null) return log("All lifts are busy!", 'w');
                const floorQueue = liftToFloors.get(nearLift); // get added queue
                const dir = qdFloor > nearLift.where ? 'UP' : 'DOWN';

                if (Array.isArray(floorQueue)) {
                    if (dirMap[nearLift.id] !== dir) {
                        const nearLiftId = freeLifts.indexOf(nearLift);
                        if (nearLiftId > -1) freeLifts.splice(nearLiftId, 1);
                        if (freeLifts.length === 0) break;
                        else i--; // one step back
                        continue;
                    }
                    
                    floorQueue.push(qdFloor);
                }
                else {

                    dirMap[nearLift.id] = dir;
                    liftToFloors.set(nearLift, [qdFloor]);
                }
                
                queue.delete(qdFloor);
            }

            for (const liftFloorsMap of liftToFloors.entries()) {
                const curFloors = liftFloorsMap[1];
                const curLift = liftFloorsMap[0];
                if (dirMap[curLift.id] === 'DOWN')
                    curFloors.sort((f, s) => (s - f));

                const dest = curFloors.pop();
                for (const stop of curFloors)
                    addNewStop(curLift, stop);
                animateLift(curLift, true, dest);
            }

            return true;
        }

        const liftInst = liftArr.find(ld => ld.goingTo === floorNo);
        
        if ((typeof liftInst !== 'undefined'))
            return animateLift(liftInst, false);
            // This floor is already occupied so only animate lift's door

        // Let's first validate the floor and input parameter
        if (!floorMap[floorNo].callable || typeof floorNo !== 'number' ||
            floorNo < 0 || floorNo > maxFloorNo) return false;
        
        const to = floorNo;
        const yTDisp = calcYDistance(floorNo);
        const curLvlEl = floorMap[to].el.parentElement;
        
        const inPathLift = getLiftInProximity(floorNo, liftArr.filter(lp => { // Find a lift which can stop at 'floorNo'
            if (!lp.busy) return false; // No sense of going forward if lift is stationary
            const toYDisp = calcYDistance(lp.goingTo); // Get Y coords of where the lift is going
            // Basically it checks if current floor lies b/w lift Y-Coord & Y-Coord of where the lift is going
            return (toYDisp < yTDisp && yTDisp < lp.at) || (toYDisp > yTDisp && yTDisp > lp.at);
        }));

        if (inPathLift !== null) 
            return addNewStop(inPathLift, floorNo);
        const freeLifts = liftArr.filter(lp => !lp.busy);
        const nextAvailLift = getLiftInProximity(floorNo, freeLifts);

        if (nextAvailLift === null) {
            // All lifts are currently busy so just add it to call queue
            curLvlEl.style.setProperty('--lvl-bg-clr', colors.red);
            floorMap[floorNo].callable = false;
            queue.add(floorNo);
            return false;
        }

        floorMap[floorNo].callable = false;
        return animateLift(nextAvailLift, true, to);
    }
        
    /**
     * Adds levels (floors) and lifts to the simulation.
     * 
     * This function takes the number of lifts and floors as input, validates the input,
     * and then creates the necessary HTML elements to represent the floors and lifts.
     * It also sets up the necessary data structures and variables for the simulation.
     * 
     * @returns {Promise<void>} A promise that resolves when the levels and lifts are added.
    */
    async function addLevels() {
        const lifts = liftEl.value;
        const speed = speedEl.value;
        const floors = floorEl.value;
        const speedVal = parseInt(`${speed}`);
        const liftsVal = parseInt(`${lifts}`);
        const floorsVal = parseInt(`${floors}`);

        if (isNaN(liftsVal) || isNaN(floorsVal) || isNaN(speedVal)) {
            alert('Enter valid Integral value!');
            floorEl.focus();
            return;
        }

        if (liftsVal < 1 || floorsVal < 1 || speedVal < 1) {
            alert('Enter value greater than 0!');
            floorEl.focus();
            return;
        }

        if (speedVal > 10) {
            alert('Speed value should not be greater than 10');
            return;
        }

        resetSimulation();
        speedFactor = speedVal;
        maxFloorNo = floorsVal - 1;

        for (let f = maxFloorNo; f > -1; f--) {
            const curLvl = getCloned('level');
            const curFlr = getCloned('floor');
            curLvl.appendChild(curFlr);
            const start = f === 0;

            floorMap[f] = {
                occupied: start,
                callable: true,
                el: curFlr,
                id: f
            };

            curFlr.classList.add(`flr-${f}`);
            const flrNmEl = curFlr.querySelector('b.nm');
            flrNmEl.innerHTML = flrNmEl.innerHTML.replace("{{FLOOR}}", `${(f + 1)}`);
            flrNmEl.innerHTML = flrNmEl.innerHTML.replace("{{POW}}", `${getNth(f + 1)}`);
            curFlr.querySelectorAll('div.cmd > div').forEach(caller => caller.addEventListener('click', () => callLift(f)));

            if (start) {
                curFlr.querySelector('.cmd .down').classList.add('hidden');
                for (let l = 0; l < liftsVal; l++) {
                    const curLift = getCloned('lift');
                    curLift.classList.add(`lft-${l}`);
                    curLvl.appendChild(curLift);

                    liftMap[l] = {
                        goingUP: true,
                        busy: false,
                        el: curLift,
                        goingTo: 0,
                        stops: [],
                        where: 0,
                        at: 0,
                        id: l
                    }
                }
            }
            else if (f === maxFloorNo) curFlr.querySelector('.cmd .up').classList.add('hidden');
            buildingEl.appendChild(curLvl);
        }

        const precision = 10000;
        floorHeight = maxFloorNo === 0 ? 0 : calcYDistance(1) * -1;
        const screenFPS = await getScreenRefreshRate(); // fps in Hertz
        animSpeed = parseInt((floorHeight / screenFPS) * precision) / precision;
        // Animation speed needs to be calculated according to the screen refresh rate (Generally 60Hz)
    }
})();
