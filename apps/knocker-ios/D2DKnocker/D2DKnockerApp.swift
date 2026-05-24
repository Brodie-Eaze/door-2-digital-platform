//
//  D2DKnockerApp.swift
//  D2D Knocker
//
//  Door 2 Digital — native iOS knocker app. SwiftUI + Swift Concurrency.
//
//  Phase 0 seed. Mobile engineer initialises full Xcode project from
//  apps/knocker-ios/README.md, then replaces this file with the real
//  app entry that wires dependencies (API client, OfflineSync, Auth,
//  Location, Attestation).
//

import SwiftUI
import SwiftData

@main
struct D2DKnockerApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [
            // Phase 0 placeholder — add @Model entities here:
            // Knock.self, Lead.self, Address.self, KnockSession.self,
            // Conversion.self, PendingSync.self
        ])
    }
}

struct ContentView: View {
    var body: some View {
        TabView {
            // Phase 0 — placeholder tabs. Real implementations land Phase 1.2.
            PlaceholderView(title: "Map", systemImage: "map")
                .tabItem { Label("Map", systemImage: "map") }

            PlaceholderView(title: "Schedule", systemImage: "calendar")
                .tabItem { Label("Schedule", systemImage: "calendar") }

            PlaceholderView(title: "Inbox", systemImage: "tray")
                .tabItem { Label("Inbox", systemImage: "tray") }

            PlaceholderView(title: "Me", systemImage: "person.crop.circle")
                .tabItem { Label("Me", systemImage: "person.crop.circle") }
        }
    }
}

struct PlaceholderView: View {
    let title: String
    let systemImage: String

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Image(systemName: systemImage)
                    .font(.system(size: 48, weight: .light))
                    .foregroundStyle(.tertiary)
                Text("\(title)")
                    .font(.title2.weight(.semibold))
                Text("Phase 0 scaffold — implementation in Phase 1.2")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle(title)
        }
    }
}

#Preview {
    ContentView()
}
