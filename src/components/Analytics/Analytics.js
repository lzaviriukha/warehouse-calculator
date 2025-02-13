// src/components/Analytics/Analytics.js
import React, { useState, useEffect } from 'react';
import Container from '../Container';
import { Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import styled from 'styled-components';

// Import and register required Chart.js modules
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Styles for the chart container
const ChartContainer = styled.div`
  margin-top: 20px;
`;

const Analytics = () => {
  const [history, setHistory] = useState([]);

  // Load updateData from localStorage and extract cpData for the chart
  useEffect(() => {
    const savedUpdateData = JSON.parse(localStorage.getItem('updateData')) || {};
    setHistory(savedUpdateData.cpData || []);
  }, []);

  // For debugging: log the history data
  console.log("History for chart:", history);

  // Prepare chart data using the cpData array
  const chartData = {
    labels: history.map(item => item.time),
    datasets: [
      {
        label: 'Planned Packing',
        data: history.map(item => item.plannedPacking), // исправлено: plannedPacking, а не plannedPacked
        borderColor: 'rgba(153,102,255,1)',
        backgroundColor: 'rgba(153,102,255,0.2)',
        fill: false,
        tension: 0.4, // Smooth the line
      },
      {
        label: 'Actual Packing',
        data: history.map(item => item.actualPacked),
        borderColor: 'rgba(75,192,192,1)',
        backgroundColor: 'rgba(75,192,192,0.2)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'Planned Picking',
        data: history.map(item => item.plannedPicking), // исправлено: plannedPicking, а не plannedPicked
        borderColor: 'rgba(255,159,64,1)',
        backgroundColor: 'rgba(255,159,64,0.2)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'Actual Picking',
        data: history.map(item => item.actualPicked),
        borderColor: 'rgba(255,99,132,1)',
        backgroundColor: 'rgba(255,99,132,0.2)',
        fill: false,
        tension: 0.4,
      },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Container>
        <h1>📈 Analytics & Reports</h1>
        {history.length > 0 ? (
          <ChartContainer>
            <Line data={chartData} />
          </ChartContainer>
        ) : (
          <p>No data available for chart display</p>
        )}
      </Container>
    </motion.div>
  );
};

export default Analytics;
