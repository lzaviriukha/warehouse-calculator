// src/utils/calculations.js

/**
 * Function to parse time from a string in the format "HH:MM AM/PM" or "HH:MM".
 * Returns an object { hours, minutes } in 24-hour format.
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return { hours: 0, minutes: 0 };
  // If the time string does not contain a space, assume 24-hour format:
  if (!timeStr.includes(' ')) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }
  // Otherwise, assume the format "HH:MM AM/PM"
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier.toUpperCase() === 'PM' && hours < 12) {
    hours += 12;
  }
  if (modifier.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  return { hours, minutes };
};

/**
 * Calculates deviations, the required speed, and other parameters.
 *
 * @param {object} settings - Shift settings, including:
 *   - shiftStart: "HH:MM AM/PM" or "HH:MM",
 *   - shiftEnd: "HH:MM AM/PM" or "HH:MM",
 *   - breaks: an array of objects [{ start: "HH:MM AM/PM", end: "HH:MM AM/PM" }, ...] or a string,
 *   - expectedOrders: the total expected number of orders for the shift,
 *   - avgPackingSpeed: the average packing speed per employee (orders per hour),
 *   - avgPickingSpeed: the average picking speed per employee (orders per hour)
 * @param {number} pickedActual - The actual number of orders picked.
 * @param {number} packedActual - The actual number of orders packed.
 * @returns {object} The calculation results, including:
 *   - packingDeviation, pickingDeviation: deviations,
 *   - hoursPassed: hours worked (taking into account the breaks that have already passed),
 *   - expectedProcessed: the expected number of orders processed by now,
 *   - requiredSpeed: the required overall speed (for the entire team),
 *   - totalWorkTime: the total working time (in hours).
 */
export const calculateDeviations = (settings, pickedActual, packedActual) => {
  const now = new Date();

  if (!settings.shiftStart || !settings.shiftEnd) {
    return {
      packingDeviation: 0,
      pickingDeviation: 0,
      hoursPassed: 0,
      expectedProcessed: 0,
      requiredSpeed: 0,
      totalWorkTime: 0,
    };
  }

  const { hours: startHour, minutes: startMinute } = parseTime(settings.shiftStart);
  const { hours: endHour, minutes: endMinute } = parseTime(settings.shiftEnd);

  const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
  const shiftEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);

  const totalShiftHours = (shiftEndDate - shiftStartDate) / (1000 * 60 * 60);

  // Calculate the total break time during the shift (full value)
  let totalBreakHours = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        totalBreakHours += (breakEnd - breakStart) / (1000 * 60 * 60);
      }
    });
  } else if (typeof settings.breaks === 'string' && settings.breaks.trim() !== '') {
    const breakIntervals = settings.breaks.split(',').map(s => s.trim());
    breakIntervals.forEach(interval => {
      const [start, end] = interval.split('-').map(s => s.trim());
      const { hours: bStartHour, minutes: bStartMinute } = parseTime(start);
      const { hours: bEndHour, minutes: bEndMinute } = parseTime(end);
      const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
      const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
      totalBreakHours += (breakEnd - breakStart) / (1000 * 60 * 60);
    });
  }

  const totalWorkTime = totalShiftHours - totalBreakHours;

  // Calculate the hours worked, taking into account breaks that have already passed
  let breakTimePassed = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        if (now > breakEnd) {
          breakTimePassed += (breakEnd - breakStart) / (1000 * 60 * 60);
        } else if (now > breakStart && now < breakEnd) {
          breakTimePassed += (now - breakStart) / (1000 * 60 * 60);
        }
      }
    });
  }
  let hoursPassed = 0;
  if (now > shiftStartDate) {
    hoursPassed = (now - shiftStartDate) / (1000 * 60 * 60) - breakTimePassed;
    if (hoursPassed > totalWorkTime) hoursPassed = totalWorkTime;
  }

  const expectedOrdersTotal = Number(settings.expectedOrders);
  const requiredSpeed = expectedOrdersTotal / totalWorkTime;
  const expectedProcessed = requiredSpeed * hoursPassed;

  const packingDeviation = Number(packedActual) - expectedProcessed;
  const pickingDeviation = Number(pickedActual) - expectedProcessed;

  return {
    packingDeviation,
    pickingDeviation,
    hoursPassed,
    expectedProcessed,
    requiredSpeed,
    totalWorkTime,
  };
};

/**
 * Calculates the expected number of orders by a given control point.
 *
 * @param {object} settings - Shift settings.
 * @param {string} controlTime - Control point time in the format "HH:MM AM/PM" or "HH:MM".
 * @returns {number} The expected number of orders by the control point.
 */
export const calculateExpectedAtTime = (settings, controlTime) => {
  if (!controlTime || !settings.shiftStart || !settings.shiftEnd) return 0;

  const now = new Date();
  const { hours: startHour, minutes: startMinute } = parseTime(settings.shiftStart);
  const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
  const { hours: cpHour, minutes: cpMinute } = parseTime(controlTime);
  const cpDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cpHour, cpMinute);

  let hoursPassed = (cpDate - shiftStartDate) / (1000 * 60 * 60);
  if (hoursPassed < 0) hoursPassed = 0;

  let breakTimePassed = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        if (breakEnd <= cpDate) {
          breakTimePassed += (breakEnd - breakStart) / (1000 * 60 * 60);
        } else if (breakStart < cpDate && breakEnd > cpDate) {
          breakTimePassed += (cpDate - breakStart) / (1000 * 60 * 60);
        }
      }
    });
  }
  const effectiveHours = Math.max(hoursPassed - breakTimePassed, 0);

  const { hours: endHour, minutes: endMinute } = parseTime(settings.shiftEnd);
  const shiftEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
  const totalShiftHours = (shiftEndDate - shiftStartDate) / (1000 * 60 * 60);

  let totalBreakHours = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        totalBreakHours += (breakEnd - breakStart) / (1000 * 60 * 60);
      }
    });
  }
  const totalWorkTime = totalShiftHours - totalBreakHours;
  const expectedOrdersTotal = Number(settings.expectedOrders);
  const requiredSpeed = expectedOrdersTotal / totalWorkTime;

  const expectedAtCP = requiredSpeed * effectiveHours;
  return expectedAtCP;
};

/**
 * Generates staffing recommendations based on deviations.
 *
 * @param {object} deviations - An object containing deviations (packingDeviation, pickingDeviation).
 * @param {object} settings - Shift settings, including avgPackingSpeed and avgPickingSpeed.
 * @returns {object} An object with recommendations for packing and picking.
 */
export const calculateRecommendations = (deviations, settings) => {
  let packingRec = '';
  let pickingRec = '';

  const individualPackingSpeed = Number(settings.avgPackingSpeed) || 0;
  const individualPickingSpeed = Number(settings.avgPickingSpeed) || 0;

  if (deviations.packingDeviation < 0) {
    const additionalEmployees = Math.abs(deviations.packingDeviation) / individualPackingSpeed;
    packingRec = `To meet the packing plan, add ${additionalEmployees.toFixed(2)} additional employees.`;
  } else if (deviations.packingDeviation > 0) {
    const employeesToRemove = deviations.packingDeviation / individualPackingSpeed;
    packingRec = `You can remove ${employeesToRemove.toFixed(2)} employees from packing.`;
  } else {
    packingRec = "The packing plan is met exactly.";
  }

  if (deviations.pickingDeviation < 0) {
    const additionalEmployees = Math.abs(deviations.pickingDeviation) / individualPickingSpeed;
    pickingRec = `To meet the picking plan, add ${additionalEmployees.toFixed(2)} additional employees.`;
  } else if (deviations.pickingDeviation > 0) {
    const employeesToRemove = deviations.pickingDeviation / individualPickingSpeed;
    pickingRec = `You can remove ${employeesToRemove.toFixed(2)} employees from picking.`;
  } else {
    pickingRec = "The picking plan is met exactly.";
  }

  return { packing: packingRec, picking: pickingRec };
};
