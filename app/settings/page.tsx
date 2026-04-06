"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

const TABS = ["Usage", "Subscription", "Preferences", "Connectors", "Memories", "Uploads"] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Usage");

  return (
    <>
      <Sidebar />
      <main className="flex-1 flex">
        {/* Left panel */}
        <div className="w-[280px] border-r border-border p-6 space-y-6">
          {/* Profile card */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                J
              </div>
              <div>
                <p className="text-text-primary font-medium">Jett Optx</p>
                <p className="text-text-secondary text-sm">@jettoptx</p>
              </div>
            </div>
            <button className="w-full text-sm text-text-secondary hover:text-red-400 transition-colors text-left">
              Sign out
            </button>
          </div>

          {/* Tabs */}
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab
                    ? "bg-card text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Right panel */}
        <div className="flex-1 p-6">
          <h2 className="text-lg font-medium text-text-primary mb-6">{activeTab}</h2>

          {activeTab === "Usage" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-text-secondary mb-2">Today's Usage</p>
                <div className="flex justify-between text-sm">
                  <span className="text-text-primary">API Calls</span>
                  <span className="text-accent">0 / 20</span>
                </div>
                <div className="w-full h-2 bg-border rounded-full mt-2">
                  <div className="h-full bg-accent rounded-full" style={{ width: "0%" }} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "Subscription" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-text-secondary mb-1">Current Plan</p>
                <p className="text-text-primary font-medium">Free</p>
              </div>
              <button className="bg-accent text-background font-medium px-4 py-2 rounded-xl hover:bg-accent-muted transition-colors">
                Upgrade to MOJO — $8.88/mo
              </button>
            </div>
          )}

          {activeTab === "Preferences" && (
            <div className="text-text-muted text-sm">Preferences coming soon.</div>
          )}

          {activeTab === "Connectors" && (
            <div className="text-text-muted text-sm">
              <span className="badge-beta mr-2">BETA</span>
              Connectors coming soon.
            </div>
          )}

          {activeTab === "Memories" && (
            <div className="text-text-muted text-sm">No memories stored.</div>
          )}

          {activeTab === "Uploads" && (
            <div className="text-text-muted text-sm">No files uploaded.</div>
          )}
        </div>
      </main>
    </>
  );
}
