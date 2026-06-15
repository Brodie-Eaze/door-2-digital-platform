// MapTabView.swift — live field map tab.
// Shows: territory polygon overlay, knock pins coloured by disposition,
// user GPS location, GPS accuracy badge, "Knock here" FAB.
// Tapping the FAB opens KnockSheetView as a bottom sheet.

import SwiftUI
import MapKit

struct MapTabView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(SyncEngine.self) private var syncEngine
    @State private var viewModel = MapViewModel()
    @State private var location = LocationService()
    @State private var showingKnockSheet = false
    @State private var knockCoordinate: CLLocationCoordinate2D?
    @State private var knockAddress: String?
    @State private var dispositionFilter: Set<KnockDisposition> = []
    // Live visible region, captured from the map camera so the +/- buttons can
    // zoom relative to wherever the rep has panned/zoomed to.
    @State private var currentRegion: MKCoordinateRegion?
    @State private var showLocating = false

    var body: some View {
        ZStack(alignment: .top) {
            // Full-bleed satellite map
            Map(position: $viewModel.cameraPosition) {
                UserAnnotation()

                // Territory polygon
                if let territory = viewModel.territory {
                    MapPolygon(coordinates: territory.coordinates)
                        .foregroundStyle(D2DColor.accent.opacity(0.16))
                        .stroke(D2DColor.accent.opacity(0.8), lineWidth: 2)
                }

                // Territory radius — a manager can define the area as a circle
                // (center + metres). Styled identically to the polygon.
                if let circle = viewModel.territoryCircle {
                    MapCircle(center: circle.center, radius: circle.radiusMeters)
                        .foregroundStyle(D2DColor.accent.opacity(0.16))
                        .stroke(D2DColor.accent.opacity(0.8), lineWidth: 2)
                }

                // Un-knocked candidate homes — hollow, tappable to knock
                ForEach(viewModel.targetHomes.filter { $0.knockedDisposition == nil }) { home in
                    Annotation("", coordinate: home.coordinate) {
                        // Button is reliably tappable inside an iOS 17 Map (unlike onTapGesture)
                        Button { openKnock(at: home.coordinate, address: home.address) } label: {
                            HomeMarker(number: home.houseNumber)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Logged knock pins — disposition-coloured (respecting the legend filter)
                ForEach(viewModel.knockAnnotations.filter { dispositionFilter.isEmpty || dispositionFilter.contains($0.disposition) }) { ann in
                    Annotation("", coordinate: ann.coordinate) {
                        KnockPin(disposition: ann.disposition)
                    }
                }
            }
            // Flat satellite+labels (not .realistic 3D terrain): a canvassing map
            // wants legibility + battery/cellular thrift over an 8-hour shift, not
            // streamed 3D elevation tiles.
            .mapStyle(.hybrid(elevation: .flat))
            .mapControls { MapUserLocationButton() }
            .ignoresSafeArea(edges: .all)
            // Capture the region only when a gesture settles (not every frame) —
            // the +/- buttons read the last settled region, so per-frame writes
            // (which re-rendered the whole map + annotation filters) were pure waste.
            .onMapCameraChange(frequency: .onEnd) { context in
                currentRegion = context.region
            }

            // Top floating chrome: territory pill + accuracy badge, then coverage bar
            VStack(spacing: 8) {
                HStack(alignment: .top) {
                    if !viewModel.territoryName.isEmpty {
                        TerritoryPill(name: viewModel.territoryName,
                                      knocked: viewModel.knockedCount,
                                      total: viewModel.totalCount)
                    }
                    Spacer()
                    GPSAccuracyBadgeView(accuracy: viewModel.locationAccuracy)
                }
                if !viewModel.territoryName.isEmpty {
                    CoverageStatsBar(territoryName: viewModel.territoryName,
                                     knocked: viewModel.knockedCount,
                                     total: viewModel.totalCount,
                                     conversions: viewModel.conversionsCount)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
            // Informational chrome only — must never intercept map pan/zoom gestures.
            .allowsHitTesting(false)

            // Honest states: loading / no-assignment / fetch error — never fake homes.
            if viewModel.isLoadingTerritory {
                MapStatusOverlay(icon: "map", title: "Loading your territory…", subtitle: nil, showSpinner: true)
            } else if viewModel.hasNoTerritory {
                MapStatusOverlay(icon: "mappin.slash",
                                 title: "No territory assigned yet",
                                 subtitle: "Your manager assigns your area in the platform.",
                                 showSpinner: false)
            } else if let err = viewModel.territoryError {
                MapStatusOverlay(icon: "exclamationmark.triangle",
                                 title: "Couldn't load your territory",
                                 subtitle: err,
                                 showSpinner: false)
            }

            // Bottom chrome: zoom control + disposition legend/filter + Knock-here FAB
            VStack(spacing: 8) {
                Spacer()
                HStack {
                    Spacer()
                    MapZoomControl(onZoomIn: { zoom(by: 0.5) }, onZoomOut: { zoom(by: 2.0) })
                }
                .padding(.horizontal, 16)
                if !viewModel.knockAnnotations.isEmpty {
                    MapLegendView(counts: viewModel.dispositionCounts, filter: $dispositionFilter)
                }
                HStack {
                    Spacer()
                    Button {
                        // Never drop a real knock pin on a hardcoded fallback (was
                        // Austin) when there's no GPS fix — that mislocates the door.
                        // Use the live location, else the assigned-area centre; if
                        // neither exists yet, ask the rep to wait for a fix.
                        if let coord = location.coordinate
                            ?? viewModel.territory?.centroid
                            ?? viewModel.territoryCircle?.center {
                            openKnock(at: coord, address: nil)
                        } else {
                            showLocating = true
                        }
                    } label: {
                        Label("Knock here", systemImage: "plus")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 22)
                            .padding(.vertical, 15)
                            .background(D2DColor.hero, in: Capsule())
                            .shadow(color: .black.opacity(0.3), radius: 12, y: 5)
                    }
                    .alert("Finding your location…", isPresented: $showLocating) {
                        Button("OK", role: .cancel) {}
                    } message: {
                        Text("Wait for a GPS fix before knocking so the door is pinned to the right spot.")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
        }
        .sheet(isPresented: $showingKnockSheet, onDismiss: {
            viewModel.refreshKnocks(context: modelContext)
        }) {
            KnockSheetView(
                coordinate: knockCoordinate ?? CLLocationCoordinate2D(latitude: MapViewModel.centerLat, longitude: MapViewModel.centerLon),
                presetAddress: knockAddress
            )
            .environment(appState)
            .environment(syncEngine)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationBackgroundInteraction(.disabled)
        }
        .task {
            location.requestWhenInUse()
            location.startUpdating()
            await viewModel.load(appState: appState)
            viewModel.refreshKnocks(context: modelContext)
        }
        .onChange(of: location.accuracy) { _, acc in viewModel.locationAccuracy = acc }
        .onReceive(NotificationCenter.default.publisher(for: .knockRecorded)) { _ in
            viewModel.refreshKnocks(context: modelContext)
        }
    }

    private func openKnock(at coordinate: CLLocationCoordinate2D, address: String?) {
        knockCoordinate = coordinate
        knockAddress = address
        showingKnockSheet = true
    }

    /// Zoom the map by scaling the visible span. factor < 1 zooms in, > 1 zooms out.
    /// Clamped so the rep can't zoom past street level or out past the metro.
    private func zoom(by factor: Double) {
        let fallback = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: MapViewModel.centerLat, longitude: MapViewModel.centerLon),
            span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
        )
        let region = currentRegion ?? fallback
        let lat = min(max(region.span.latitudeDelta * factor, 0.0006), 80)
        let lon = min(max(region.span.longitudeDelta * factor, 0.0006), 80)
        let target = MKCoordinateRegion(
            center: region.center,
            span: MKCoordinateSpan(latitudeDelta: lat, longitudeDelta: lon)
        )
        currentRegion = target
        withAnimation(.easeInOut(duration: 0.25)) {
            viewModel.cameraPosition = .region(target)
        }
    }
}

// MARK: - Map zoom control (+/-)

struct MapZoomControl: View {
    let onZoomIn: () -> Void
    let onZoomOut: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            button("plus", action: onZoomIn)
            Divider().frame(width: 28)
            button("minus", action: onZoomOut)
        }
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(.white.opacity(0.35), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.18), radius: 8, y: 3)
    }

    private func button(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Home marker (un-knocked house)

struct HomeMarker: View {
    var number: String = ""

    var body: some View {
        VStack(spacing: 2) {
            ZStack {
                Circle()
                    .fill(.white)
                    .frame(width: 22, height: 22)
                    .overlay(Circle().strokeBorder(D2DColor.ink.opacity(0.45), lineWidth: 2))
                    .shadow(color: .black.opacity(0.35), radius: 2)
                Image(systemName: "house.fill")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(D2DColor.ink.opacity(0.65))
            }
            if !number.isEmpty {
                Text(number)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(D2DColor.ink.opacity(0.7), in: Capsule())
            }
        }
    }
}

// MARK: - Territory pill (top-left floating)

struct TerritoryPill: View {
    let name: String
    let knocked: Int
    let total: Int

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(D2DColor.accent)
                .frame(width: 8, height: 8)
            Text(name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
            Text("· \(knocked) / \(total)")
                .font(.system(size: 13, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(D2DColor.muted)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.regularMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
    }
}

// MARK: - Knock pin view

struct KnockPin: View {
    let disposition: KnockDisposition

    var body: some View {
        ZStack {
            Circle()
                .fill(disposition.color)
                .frame(width: 22, height: 22)
                .shadow(color: disposition.color.opacity(0.5), radius: 4)
            Image(systemName: disposition.systemImage)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white)
        }
    }
}

// MARK: - GPS accuracy badge

struct GPSAccuracyBadgeView: View {
    let accuracy: Double

    private var tone: String {
        if accuracy < 10 { return "good" }
        if accuracy < 30 { return "fair" }
        return "poor"
    }
    private var color: Color {
        if accuracy < 10 { return D2DColor.success }
        if accuracy < 30 { return D2DColor.warn }
        return D2DColor.danger
    }

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(accuracy < 999 ? "±\(Int(accuracy))m" : "GPS…")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.12), in: Capsule())
    }
}

// MARK: - Shift stats strip

struct ShiftStatsStrip: View {
    let knocks: Int
    let conversions: Int
    let isOnShift: Bool

    var convRate: Double { knocks > 0 ? Double(conversions) / Double(knocks) * 100 : 0 }

    var body: some View {
        HStack(spacing: 0) {
            statItem(label: "Knocks", value: "\(knocks)")
            Divider().frame(height: 28)
            statItem(label: "Convs.", value: "\(conversions)")
            Divider().frame(height: 28)
            statItem(label: "Rate", value: String(format: "%.1f%%", convRate))
            if isOnShift {
                Divider().frame(height: 28)
                HStack(spacing: 4) {
                    Circle().fill(D2DColor.success).frame(width: 6, height: 6)
                    Text("On shift").font(.system(size: 11, weight: .medium)).foregroundStyle(D2DColor.success)
                }
                .padding(.horizontal, 12)
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.1), radius: 6, y: 2)
        .padding(.horizontal, 16)
    }

    private func statItem(label: String, value: String) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(D2DColor.ink)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(D2DColor.muted)
        }
        .frame(minWidth: 52)
    }
}

// MARK: - Map status overlay (loading / no-territory / error)

struct MapStatusOverlay: View {
    let icon: String
    let title: String
    let subtitle: String?
    let showSpinner: Bool

    var body: some View {
        VStack(spacing: 10) {
            if showSpinner {
                ProgressView().tint(D2DColor.accent)
            } else {
                Image(systemName: icon)
                    .font(.system(size: 30))
                    .foregroundStyle(D2DColor.muted)
            }
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
                .multilineTextAlignment(.center)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(D2DColor.muted)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(22)
        .frame(maxWidth: 300)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: D2DRadius.lg))
        .shadow(color: .black.opacity(0.18), radius: 14, y: 4)
        // Centered informational card — must not swallow the map's pinch/pan.
        .allowsHitTesting(false)
    }
}

// MARK: - Notification name

extension Notification.Name {
    static let knockRecorded = Notification.Name("knockRecorded")
}
