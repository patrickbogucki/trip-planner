import React, { useRef } from 'react';
import { Sun, Moon, Laptop, X, Upload, Download, RotateCcw } from 'lucide-react';
import type { CommuteMode, Trip } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'system' | 'light' | 'dark';
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
  distanceUnit: 'km' | 'mi';
  onDistanceUnitChange: (unit: 'km' | 'mi') => void;
  defaultCommuteMode: CommuteMode;
  onDefaultCommuteModeChange: (mode: CommuteMode) => void;
  mapboxToken: string;
  onMapboxTokenChange: (token: string) => void;
  activeTrip: Trip;
  onImportTrip: (trip: Trip) => void;
  onResetApp: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  distanceUnit,
  onDistanceUnitChange,
  defaultCommuteMode,
  onDefaultCommuteModeChange,
  mapboxToken,
  onMapboxTokenChange,
  activeTrip,
  onImportTrip,
  onResetApp,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeTrip, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      const safeName = activeTrip.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      downloadAnchor.setAttribute('download', `${safeName}-backup.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      console.error('Failed to export trip:', error);
      alert('Unable to export trip data.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const resultText = event.target?.result as string;
        const parsed = JSON.parse(resultText) as Trip;

        if (!parsed.id || !parsed.name || !parsed.days) {
          throw new Error('Missing crucial fields (id, name, or days).');
        }

        onImportTrip(parsed);
        alert(`Successfully imported trip "${parsed.name}"!`);
      } catch (err) {
        console.error('Import validation failed:', err);
        alert('Invalid backup file. Please upload a valid Horizon JSON backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="settings-panel-header">
        <h2>Settings</h2>
        <button className="settings-close-btn" onClick={onClose} aria-label="Close Settings">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="settings-panel-content">
        {/* Theme Section */}
        <div className="settings-section">
          <h3>Theme Preference</h3>
          <div className="segmented-control">
            <button
              className={`segmented-control-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => onThemeChange('light')}
            >
              <Sun size={14} />
              Light
            </button>
            <button
              className={`segmented-control-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => onThemeChange('system')}
            >
              <Laptop size={14} />
              System
            </button>
            <button
              className={`segmented-control-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeChange('dark')}
            >
              <Moon size={14} />
              Dark
            </button>
          </div>
        </div>

        {/* Distance Units Section */}
        <div className="settings-section">
          <h3>Distance Units</h3>
          <div className="segmented-control">
            <button
              className={`segmented-control-btn ${distanceUnit === 'km' ? 'active' : ''}`}
              onClick={() => onDistanceUnitChange('km')}
            >
              Metric (km)
            </button>
            <button
              className={`segmented-control-btn ${distanceUnit === 'mi' ? 'active' : ''}`}
              onClick={() => onDistanceUnitChange('mi')}
            >
              Imperial (mi)
            </button>
          </div>
        </div>

        {/* Default Travel Mode Section */}
        <div className="settings-section">
          <h3>Default Commute</h3>
          <div className="settings-description">
            Preferred travel mode when adding new stops.
          </div>
          <select
            className="settings-select"
            value={defaultCommuteMode}
            onChange={(e) => onDefaultCommuteModeChange(e.target.value as CommuteMode)}
          >
            <option value="driving">Driving</option>
            <option value="transit">Transit</option>
            <option value="walking">Walking</option>
            <option value="bicycle">Bicycling</option>
          </select>
        </div>

        {/* Developer Utilities (Local Dev Only - Stripped in Production) */}
        {import.meta.env.DEV && (
          <>
            <div className="settings-divider" />
            
            <div className="settings-section">
              <h3>Developer Settings</h3>
              <div className="settings-description" style={{ color: 'var(--warning)', fontWeight: 500 }}>
                Local Development Utilities (DEV ONLY)
              </div>
            </div>

            {/* Custom Mapbox Token Input */}
            <div className="settings-section">
              <label htmlFor="dev-mapbox-token" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Mapbox Token Override
              </label>
              <input
                id="dev-mapbox-token"
                type="text"
                className="settings-input"
                placeholder="Paste pk.eyJ1..."
                value={mapboxToken}
                onChange={(e) => onMapboxTokenChange(e.target.value)}
              />
              <span className="settings-description">
                Saves in localStorage. Fallback is .env file.
              </span>
            </div>

            {/* Trip Import/Export */}
            <div className="settings-section">
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Trip Backups</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="settings-btn settings-btn-secondary" onClick={handleExport} style={{ flex: 1 }}>
                  <Download size={14} />
                  Export
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".json"
                  onChange={handleFileChange}
                />
                <button
                  className="settings-btn settings-btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flex: 1 }}
                >
                  <Upload size={14} />
                  Import
                </button>
              </div>
            </div>

            {/* Clear Data Reset */}
            <div className="settings-section">
              <button className="settings-btn settings-btn-danger" onClick={onResetApp}>
                <RotateCcw size={14} />
                Reset App & Demo Data
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
