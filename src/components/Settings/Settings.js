// src/components/Settings/Settings.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import Container from '../Container';
import Button from '../Button';
import Input from '../Input';

// Container for the form using CSS Grid
const FormContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 20px;
`;

// Each form field block
const FormField = styled.div`
  display: flex;
  flex-direction: column;
`;

// Styled label for fields
const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #555;
`;

// Small button for adding/deleting elements
const SmallButton = styled.button`
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 6px;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
  &:hover {
    background: #e0e0e0;
  }
  margin-top: 4px;
`;

const Settings = () => {
  const navigate = useNavigate();

  // Main settings states
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [expectedOrders, setExpectedOrders] = useState('');
  // Одно поле для средней скорости (для обоих процессов)
  const [avgSpeed, setAvgSpeed] = useState('');
  const [staffForLastPeriod, setStaffForLastPeriod] = useState('');

  // Arrays for breaks and control points
  const [breaks, setBreaks] = useState([]);
  const [controlPoints, setControlPoints] = useState([]);

  // On mount, load settings from localStorage
  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem('settings'));
    if (settings) {
      setShiftStart(settings.shiftStart || '');
      setShiftEnd(settings.shiftEnd || '');
      // Load breaks
      if (settings.breaks) {
        if (Array.isArray(settings.breaks)) {
          setBreaks(settings.breaks);
        } else if (typeof settings.breaks === 'string' && settings.breaks.trim() !== '') {
          const arr = settings.breaks.split(',').map(interval => {
            const parts = interval.split('-').map(s => s.trim());
            return { start: parts[0] || '', end: parts[1] || '' };
          });
          setBreaks(arr);
        }
      }
      // Load control points (ensure each element has format { time: "HH:MM" })
      if (settings.controlPoints) {
        if (Array.isArray(settings.controlPoints)) {
          const validCP = settings.controlPoints.map(cp =>
            typeof cp === 'object' && cp.time ? { time: cp.time } : { time: cp }
          );
          setControlPoints(validCP);
        } else if (typeof settings.controlPoints === 'string' && settings.controlPoints.trim() !== '') {
          const cpArr = settings.controlPoints.split(',').map(cp => ({ time: cp.trim() }));
          setControlPoints(cpArr);
        }
      }
      setExpectedOrders(settings.expectedOrders || '');
      // Используем одно поле для средней скорости
      setAvgSpeed(settings.avgSpeed || '');
      setStaffForLastPeriod(settings.staffForLastPeriod || '');
    }
  }, []);

  // Function to calculate the last working hour interval based on shiftEnd.
  const getLastHourInterval = () => {
    if (!shiftEnd) return '';
    const [endHour, endMinute] = shiftEnd.split(':').map(Number);
    // Create a date object with shiftEnd and subtract 1 hour.
    const endDate = new Date(0, 0, 0, endHour, endMinute);
    endDate.setHours(endDate.getHours() - 1);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}–${shiftEnd}`;
  };

  const lastHourInterval = getLastHourInterval();

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      shiftStart,
      shiftEnd,
      breaks,           // array of objects { start, end }
      controlPoints,    // array of objects { time }
      expectedOrders,
      avgSpeed,         // one field for average speed
      staffForLastPeriod,
    };
    localStorage.setItem('settings', JSON.stringify(settings));
    alert('Settings saved!');
    navigate('/update');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Container>
        <h1>⚙️ Shift Settings</h1>
        <FormContainer>
          <FormField>
            <Label>Shift Start Time:</Label>
            <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
          </FormField>
          <FormField>
            <Label>Shift End Time:</Label>
            <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
          </FormField>
          <FormField>
            <Label>Breaks:</Label>
            {breaks.map((brk, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Input
                  type="time"
                  value={brk.start || ''}
                  onChange={(e) => {
                    const newBreaks = [...breaks];
                    newBreaks[index] = { start: e.target.value, end: newBreaks[index].end || '' };
                    setBreaks(newBreaks);
                  }}
                  placeholder="Start"
                  style={{ maxWidth: '120px' }}
                />
                <Input
                  type="time"
                  value={brk.end || ''}
                  onChange={(e) => {
                    const newBreaks = [...breaks];
                    newBreaks[index] = { start: newBreaks[index].start || '', end: e.target.value };
                    setBreaks(newBreaks);
                  }}
                  placeholder="End"
                  style={{ maxWidth: '120px' }}
                />
                <SmallButton onClick={() => setBreaks(breaks.filter((_, i) => i !== index))}>
                  Delete
                </SmallButton>
              </div>
            ))}
            <SmallButton onClick={() => setBreaks([...breaks, { start: '', end: '' }])}>
              Add Break
            </SmallButton>
          </FormField>
          <FormField>
            <Label>Control Points:</Label>
            {controlPoints.map((cp, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Input
                  type="time"
                  value={cp.time || ''}
                  onChange={(e) => {
                    const newCP = [...controlPoints];
                    newCP[index] = { time: e.target.value };
                    setControlPoints(newCP);
                  }}
                  placeholder="Control Point Time"
                  style={{ maxWidth: '120px' }}
                />
                <SmallButton onClick={() => setControlPoints(controlPoints.filter((_, i) => i !== index))}>
                  Delete
                </SmallButton>
              </div>
            ))}
            <SmallButton onClick={() => setControlPoints([...controlPoints, { time: '' }])}>
              Add Control Point
            </SmallButton>
          </FormField>
          <FormField>
            <Label>Expected Number of Orders:</Label>
            <Input type="number" value={expectedOrders} onChange={(e) => setExpectedOrders(e.target.value)} />
          </FormField>
          <FormField>
            <Label>Average Speed (one worker per hour):</Label>
            <Input type="number" value={avgSpeed} onChange={(e) => setAvgSpeed(e.target.value)} />
          </FormField>
          <FormField>
            <Label>Number of staff in the last hour ({lastHourInterval}):</Label>
            <Input type="number" value={staffForLastPeriod} onChange={(e) => setStaffForLastPeriod(e.target.value)} />
          </FormField>
        </FormContainer>
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Button onClick={saveSettings}>Save Settings</Button>
        </div>
      </Container>
    </motion.div>
  );
};

export default Settings;
