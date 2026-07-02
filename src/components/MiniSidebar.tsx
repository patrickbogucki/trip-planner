import React from 'react';
import { Compass, Calendar, Search, Settings } from 'lucide-react';

interface MiniSidebarProps {
  activeTab: 'itinerary' | 'search';
  onTabChange: (tab: 'itinerary' | 'search') => void;
  onSettingsClick: () => void;
  isSettingsOpen: boolean;
}

export const MiniSidebar: React.FC<MiniSidebarProps> = ({
  activeTab,
  onTabChange,
  onSettingsClick,
  isSettingsOpen,
}) => {
  return (
    <aside className="mini-sidebar">
      {/* Top Group: Brand Logo & Navigation Tabs */}
      <div className="mini-sidebar-group" style={{ gap: '1rem' }}>
        <div className="mini-sidebar-logo" title="Horizon" style={{ marginBottom: '0.75rem' }}>
          <Compass className="brand-icon" />
        </div>

        <button
          className={`mini-sidebar-btn ${activeTab === 'itinerary' && !isSettingsOpen ? 'active' : ''}`}
          onClick={() => onTabChange('itinerary')}
          title="Itinerary"
          aria-label="Itinerary"
        >
          <Calendar size={20} />
          <span>Itinerary</span>
        </button>
        <button
          className={`mini-sidebar-btn ${activeTab === 'search' && !isSettingsOpen ? 'active' : ''}`}
          onClick={() => onTabChange('search')}
          title="Search & Pins"
          aria-label="Search & Pins"
        >
          <Search size={20} />
          <span>Search</span>
        </button>
      </div>

      {/* Settings Icon */}
      <button
        className={`mini-sidebar-btn ${isSettingsOpen ? 'active' : ''}`}
        onClick={onSettingsClick}
        title="Settings"
        aria-label="Settings"
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </aside>
  );
};
