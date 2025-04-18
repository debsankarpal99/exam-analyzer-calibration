import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ScoreChart = ({ scores }) => {
  if (!scores || Object.keys(scores).length === 0) return null;

  const topics = Object.keys(scores);
  const scoreValues = topics.map(topic => scores[topic] !== null ? scores[topic] : 0);

  // Utility to wrap labels into lines of max 3 words
  const wrapLabel = (label) => {
    const words = label.split(' ');
    const lines = [];
    for (let i = 0; i < words.length; i += 3) {
      lines.push(words.slice(i, i + 3).join(' '));
    }
    return lines;
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1200,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: '📊 Exam Score by Topic',
        font: {
          size: 22,
          weight: 'bold',
        },
        color: '#333',
        padding: {
          top: 10,
          bottom: 30,
        }
      },
      tooltip: {
        bodyFont: {
          size: 14,
        },
        callbacks: {
          label: function(context) {
            const topic = context.label;
            const score = scores[topic];
            return score !== null ? `Score: ${score.toFixed(1)}%` : 'Not detected';
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
          text: 'Score (%)',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          font: {
            size: 12,
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: 12,
          },
          callback: function(val, index) {
            return wrapLabel(this.getLabelForValue(val));
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
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  return (
    <div className="mt-8">
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '650px', height: '440px', padding: '1rem' }}>
          <Bar options={options} data={data} />
        </div>
      </div>
    </div>
  );
};

export default ScoreChart;
