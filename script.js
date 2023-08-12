(() => { // Closure to prevent functions & variables from being accessed by console or window object!
    let buildingHeight = 0;
    let maxFloorNo = 0;
    let floorMap = {}; // properties: occupied, liftId, el
    let liftMap = {}; // properties: busy, where, el, id
    let priority = 0;
    let queue = {};
    
    document.querySelector('.settings button.rst').addEventListener('click', resetSimulation);
    document.querySelector('.settings button.gen').addEventListener('click', addLevels);
    const buildingEl = document.querySelector('.apartment > .building');
    const floorEl = document.querySelector('#floor-data > input');
    const liftEl = document.querySelector('#lift-data > input');
    resetSimulation();
    floorEl.focus();

    function getCloned(elType) {
        switch (elType) {
            case 'level': return document.querySelector('#template > div.level').cloneNode(true);
            case 'floor': return document.querySelector('#template > div.floor').cloneNode(true);
            case 'lift': return document.querySelector('#template > div.lift').cloneNode(true);
            default: return document.querySelector('#template').cloneNode(true);
        }
    }

    function calcYDistance(to) {
        const fromYCord = document.querySelector(`.building .floor.flr-0`).getBoundingClientRect().y;
        const toYCord = document.querySelector(`.building .floor.flr-${to}`).getBoundingClientRect().y;
        const displacement = Math.abs(fromYCord - toYCord); const fct = 10000;
        const finalDisp = parseInt(displacement * fct) / fct;
        return (-1 * finalDisp);
    }

    // We should prioritize the floor which was called first
    function checkExecQueue() {
        const queueEntries = Object.entries(queue);
        if (queueEntries.length === 0) return;
        queueEntries.sort((f, s) => f[1] - s[1]);
        const priorityFloor = parseInt(queueEntries[0][0]);
        if (callLift(priorityFloor)) delete queue[priorityFloor];
    }

    function animateLift(lift, travel = true, to = 0) {
        const events = ['animationend', 'transitionend'];
        const levelEl = floorMap[to].el.parentElement;
        const yDisplacement = calcYDistance(to);
        if (lift.busy) return false;
        lift.busy = true;

        function animateDoor() {
            const handleAnimEnd = () => {
                lift.el.removeEventListener(events[0], handleAnimEnd);
                lift.el.classList.remove('anim');
                lift.busy = false;
                checkExecQueue();
            };

            lift.el.classList.add('anim');
            lift.el.addEventListener(events[0], handleAnimEnd);
            levelEl.style.setProperty('--lvl-bg-clr', '#00ffba14');
        }

        if (!travel) {
            animateDoor();
            return false;
        }

        // ToDo: Change visuals of 'to' floor to calling(Red) called(Green)
        // ToDo: Alter up-down button also
        
        const onTranslationEnd = () => { // Called whenever lift completes travel in Y direction
            lift.el.removeEventListener(events[1], onTranslationEnd);
            animateDoor(); // Trigger open-close door animation
        };

        let linearTime = parseInt(((Math.abs(calcYDistance(lift.where) - yDisplacement)) / 200) * 100) / 100;
        lift.el.style.transition = `transform ${(linearTime < 1.5 ? 1.5 : linearTime)}s ease`;
        lift.el.style.transform = `translateY(${yDisplacement}px)`;
        levelEl.style.setProperty('--lvl-bg-clr', '#ebff001f');
        lift.el.addEventListener(events[1], onTranslationEnd);
        lift.where = to;
        return true;
    }

    function callLift(floorNo) {
        // Let's first validate input parameter
        if (typeof floorNo !== 'number' || floorNo < 0 || floorNo > maxFloorNo) return false;
        const liftArr = Object.values(liftMap); // Array of properties of all lift
        const liftInst = liftArr.find(ld => ld.where === floorNo);

        if (typeof liftInst !== 'undefined') {
            // This floor is already occupied
            return animateLift(liftInst, false);
        }

        const availLifts = liftArr.filter(lp => !lp.busy);
        let nextAvailLift = availLifts[0];
        let nearestDelta = maxFloorNo + 1;
        const to = floorNo;

        for (const liftDets of availLifts) {
            const curDelta = Math.abs(floorNo - liftDets.where);
            if (curDelta < nearestDelta) {
                nextAvailLift = liftDets;
                nearestDelta = curDelta;
            }
        }

        if (typeof nextAvailLift === 'undefined') {
            // All lifts are currently busy so just add it to call queue and update the priority
            floorMap[to].el.parentElement.style.setProperty('--lvl-bg-clr', '#ff00ac1f');
            if (typeof queue[floorNo] === 'undefined')
                queue[floorNo] = ++priority;
            return false;
        }

        return animateLift(nextAvailLift, true, to);
    }

    function resetSimulation() {
        buildingEl.innerHTML = "";
        floorMap = {};
        liftMap = {};
        priority = 0;
        queue = {};
    }

    function getNth(num) {
        return ["st", "nd", "rd"]
            [(((num < 0 ? -num : num) + 90)
                % 100 - 10) % 10 - 1] || "th"
    }

    function addLevels() {
        const lifts = liftEl.value;
        const floors = floorEl.value;
        const liftsVal = parseInt(`${lifts}`);
        const floorsVal = parseInt(`${floors}`);

        if (isNaN(liftsVal) || isNaN(floorsVal)) {
            alert('Enter valid Integral value!');
            floorEl.focus();
            return;
        }

        if (liftsVal < 1 || floorsVal < 1) {
            alert('Enter value greater than 0!');
            floorEl.focus();
            return;
        }

        resetSimulation();
        maxFloorNo = floorsVal - 1;

        for (let f = maxFloorNo; f > -1; f--) {
            const curLvl = getCloned('level');
            const curFlr = getCloned('floor');
            curLvl.appendChild(curFlr);
            const start = f === 0;

            floorMap[f] = {
                occupied: start,
                el: curFlr,
                liftId: 0,
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
                        busy: false,
                        el: curLift,
                        where: 0,
                        id: l
                    }
                }
            }
            else if (f === maxFloorNo) curFlr.querySelector('.cmd .up').classList.add('hidden');

            buildingEl.appendChild(curLvl);
        }

        buildingHeight = calcYDistance(maxFloorNo) * -1;
    }

})();
