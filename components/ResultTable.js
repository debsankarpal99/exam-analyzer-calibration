import React from 'react';
import { saveAs } from 'file-saver';

const ResultTable = ({ scores }) => {
  if (!scores || Object.keys(scores).length === 0) return null;

  const handleDownloadCSV = () => {
    let csv = "Topic,Score (%)\n";
    
    Object.entries(scores).forEach(([topic, score]) => {
      const scoreValue = score !== null ? score.toFixed(1) : 'N/A';
      csv += `"${topic}",${scoreValue}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'exam_scores.csv');
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Analysis Results</h2>
      
      <table className="result-table">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Score (%)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(scores).map(([topic, score], index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
              <td>{topic}</td>
              <td>{score !== null ? `${score.toFixed(1)}%` : 'Not detected'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        onClick={handleDownloadCSV}
      >
        Download as CSV
      </button>
    </div>
  );
};

export default ResultTable;
