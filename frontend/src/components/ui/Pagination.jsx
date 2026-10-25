import React from "react";

export const Pagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", marginTop: "1rem" }}>
      <button
        className="btn btn-outline"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        style={{ opacity: currentPage <= 1 ? 0.5 : 1 }}
      >
        Previous
      </button>
      <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0.5rem" }}>
        Page {currentPage} of {totalPages}
      </span>
      <button
        className="btn btn-outline"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        style={{ opacity: currentPage >= totalPages ? 0.5 : 1 }}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
