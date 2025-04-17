import React, { useRef, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ScoreChart = ({ scores }) => {
  if (!scores || Object.keys(scores).length === 0) return null;

  const topics = Object.keys(scores);
  const scoreValues = topics.map(topic => scores[topic] !== null ? scores[topic] : 0);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Exam Score by Topic',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const topic = context.label;
            const score = scores[topic];
            return score !== null ? `${score.toFixed(1)}%` : 'Not detected';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Score (%)'
        }
      },
      x: {
        ticks: {
          callback: function(val) {
            // Abbreviate long topic names for display
            const label = this.getLabelForValue(val);
            return label.length > 15 ? label.substring(0, 15) + '...' : label;
          }
        }
      }
    }
  };

  const data = {
    labels: topics,
    datasets: [
      {
        label: 'Score (%)',
        data: scoreValues,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="mt-8">
      <div style={{ height: '400px' }}>
        <Bar options={options} data={data} />
      </div>
    </div>
  );
};

export default ScoreChart;
