/**
 * shared/table-loader.js
 * Phase E: No-destructive-loading table helper
 *
 * Implements stale-while-refresh pattern:
 * - Keep existing rows visible during background refresh
 * - Show subtle "Memperbarui..." indicator
 * - Atomic table replacement when fresh data ready
 * - Graceful error handling (keep old rows on transient failure)
 *
 * Usage:
 *   const loader = new TableLoader('tbody', { indicatorText: 'Memperbarui...' })
 *   loader.load('/api/data', row => createRowElement(row))
 */

(function(global) {
  'use strict';

  class TableLoader {
    constructor(tableBodySelector, options) {
      this.tbody = document.querySelector(tableBodySelector);
      this.options = options || {};
      this.lastData = null;
      this.isLoading = false;
      this.indicatorText = this.options.indicatorText || 'Memperbarui...';
    }

    /**
     * Load data and refresh table (stale-while-refresh pattern)
     * @param {string} apiPath - API endpoint to fetch
     * @param {function} rowTransform - Function to transform row data to DOM element
     * @param {boolean} isBackgroundRefresh - If true, keep old rows visible during fetch
     */
    async load(apiPath, rowTransform, isBackgroundRefresh = true) {
      if (!this.tbody) return null;

      this.isLoading = true;
      let indicator = null;

      try {
        // Show subtle indicator only for background refresh
        if (isBackgroundRefresh) {
          indicator = this.createRefreshIndicator();
        }

        // Fetch fresh data
        const response = await fetch(apiPath);

        if (response.status === 401) {
          // Stale token - allow session refresh to retry
          throw new Error('SESSION_REFRESH_NEEDED');
        }

        if (response.status === 403) {
          // Permission denied - keep session, show error
          throw new Error('PERMISSION_DENIED');
        }

        if (!response.ok) {
          // Transient error (network, 5xx, etc.)
          throw new Error('TRANSIENT_ERROR');
        }

        const fresh = await response.json();
        this.lastData = fresh;

        // Atomically replace rows (no flicker)
        this.replaceRows(fresh, rowTransform);

        return fresh;
      } catch (err) {
        const errorMsg = err && err.message ? err.message : String(err);

        if (errorMsg === 'SESSION_REFRESH_NEEDED') {
          // Let caller handle session refresh
          throw err;
        }

        if (errorMsg === 'PERMISSION_DENIED') {
          // Permission error - show error but keep session
          this.showError('Akses ditolak');
          return this.lastData;
        }

        // Transient error (network, 5xx, etc.)
        if (isBackgroundRefresh && this.lastData) {
          // Keep existing rows visible, show error
          this.showError('Gagal memperbarui. Retry? (dalam 10s)');
          // Optionally retry after delay
          setTimeout(() => this.retryLoad(apiPath, rowTransform), 10000);
          return this.lastData;
        }

        // First load failed - show error state
        this.showError('Gagal memuat data');
        throw err;
      } finally {
        this.isLoading = false;
        if (indicator) indicator.remove();
      }
    }

    /**
     * Retry loading after transient failure
     */
    async retryLoad(apiPath, rowTransform) {
      return this.load(apiPath, rowTransform, false);
    }

    /**
     * Replace table rows atomically (no intermediate blank state)
     */
    replaceRows(data, rowTransform) {
      if (!this.tbody) return;

      // Build fresh rows outside DOM
      const fragment = document.createDocumentFragment();
      const rows = Array.isArray(data) ? data : [data];

      rows.forEach(rowData => {
        try {
          const rowElement = rowTransform(rowData);
          if (rowElement) fragment.appendChild(rowElement);
        } catch (err) {
          console.warn('[TableLoader] Row transform error:', err);
        }
      });

      // Atomically replace (minimal reflow)
      this.tbody.innerHTML = '';
      this.tbody.appendChild(fragment);
    }

    /**
     * Create subtle refresh indicator
     */
    createRefreshIndicator() {
      const div = document.createElement('div');
      div.className = 'table-loader-indicator';
      div.setAttribute('aria-live', 'polite');
      div.setAttribute('aria-busy', 'true');

      const spinner = document.createElement('span');
      spinner.className = 'table-loader-spinner';
      spinner.innerHTML = '↻';

      const text = document.createElement('span');
      text.className = 'table-loader-text';
      text.textContent = this.indicatorText;

      div.appendChild(spinner);
      div.appendChild(text);

      // Style inline if not already styled
      if (!document.getElementById('table-loader-styles')) {
        const style = document.createElement('style');
        style.id = 'table-loader-styles';
        style.textContent = `
          .table-loader-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: rgba(0,0,0,0.05);
            border: 1px solid rgba(0,0,0,0.1);
            border-radius: 6px;
            font-size: 14px;
            color: rgba(0,0,0,0.6);
            animation: fade-in 0.2s ease-in-out;
          }
          .table-loader-spinner {
            display: inline-block;
            animation: spin 1s linear infinite;
            font-size: 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-color-scheme: dark) {
            .table-loader-indicator {
              background: rgba(255,255,255,0.05);
              border-color: rgba(255,255,255,0.1);
              color: rgba(255,255,255,0.6);
            }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(div);
      return div;
    }

    /**
     * Show error message
     */
    showError(message) {
      const toast = document.createElement('div');
      toast.className = 'table-loader-error';
      toast.setAttribute('role', 'alert');
      toast.textContent = message;

      // Style inline if not already styled
      if (!document.getElementById('table-loader-error-styles')) {
        const style = document.createElement('style');
        style.id = 'table-loader-error-styles';
        style.textContent = `
          .table-loader-error {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 101;
            padding: 12px 16px;
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 6px;
            font-size: 14px;
            color: #c33;
            animation: fade-in 0.2s ease-in-out;
          }
          @media (prefers-color-scheme: dark) {
            .table-loader-error {
              background: rgba(255,100,100,0.1);
              border-color: rgba(255,100,100,0.2);
              color: rgba(255,150,150,0.9);
            }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(toast);

      // Auto-remove after 5 seconds
      setTimeout(() => toast.remove(), 5000);
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableLoader;
  }
  global.TableLoader = TableLoader;

})(typeof window !== 'undefined' ? window : global);
