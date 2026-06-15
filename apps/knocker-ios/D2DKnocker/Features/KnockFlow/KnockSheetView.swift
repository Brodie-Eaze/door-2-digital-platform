// KnockSheetView.swift — single-screen knock card (matches the mockup).
// Address → DISPOSITION grid → name/phone → Photo/Sign → Save knock.

import SwiftUI
import CoreLocation
import SwiftData
import PhotosUI

struct KnockSheetView: View {
    let coordinate: CLLocationCoordinate2D
    let presetAddress: String?

    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: KnockFlowViewModel
    // The app-owned sync engine, injected from ContentView — NOT a second instance
    // (two engines racing the same queue burned the retry budget on every save).
    @Environment(SyncEngine.self) private var syncEngine
    @State private var showSignature = false
    @State private var photoItem: PhotosPickerItem?
    @State private var photoDialog = false
    @State private var showLibrary = false
    @State private var showCamera = false
    @State private var showServicePicker = false

    init(coordinate: CLLocationCoordinate2D, presetAddress: String? = nil) {
        self.coordinate = coordinate
        self.presetAddress = presetAddress
        self._viewModel = State(initialValue: KnockFlowViewModel(coordinate: coordinate))
    }

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.step {
                case .saving:
                    savingView
                case .error:
                    errorView
                case .done:
                    if let sale = viewModel.savedSale {
                        // Honest: no per-rep commission rate exists client-side, so
                        // we never present the customer's plan price as the rep's
                        // earnings. The plan amount is echoed via amountLabel; the
                        // "you earned" line is suppressed (commissionLabel: nil).
                        SaleWonView(customerName: sale.customerName,
                                    serviceName: sale.serviceName,
                                    amountLabel: sale.amountLabel,
                                    commissionLabel: nil,
                                    onDone: { dismiss() })
                    } else {
                        KnockSavedView(knock: viewModel.savedKnock, onDismiss: { dismiss() })
                            .padding(D2DSpacing.lg)
                    }
                default:
                    form
                }
            }
            .background(D2DColor.paper)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if viewModel.step != .done && viewModel.step != .saving {
                        Button("Cancel") { dismiss() }
                            .foregroundStyle(D2DColor.muted)
                    }
                }
            }
        }
        .onAppear {
            if let presetAddress, !presetAddress.isEmpty {
                viewModel.addressLine = presetAddress
            } else {
                reverseGeocode()
            }
        }
        .task(id: viewModel.step) {
            if case .saving = viewModel.step {
                await viewModel.saveKnock(context: modelContext, appState: appState, syncEngine: syncEngine)
            }
        }
        .onChange(of: viewModel.step) { _, step in
            // One-tap terminal dispositions: auto-dismiss after the brief "Knock
            // saved" confirmation so the rep is back on the map in under a second.
            if step == .done && viewModel.isTerminalDisposition {
                Task { try? await Task.sleep(for: .seconds(0.7)); dismiss() }
            }
        }
        .sheet(isPresented: $showSignature) {
            NavigationStack {
                SignaturePadView(lines: $viewModel.signatureLines, onProceed: { showSignature = false })
                    .padding(D2DSpacing.lg)
                    .navigationTitle("Signature")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showSignature = false }
                        }
                    }
            }
            .presentationDetents([.medium])
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    viewModel.photoData = data
                }
            }
        }
        .confirmationDialog("Add a photo", isPresented: $photoDialog, titleVisibility: .visible) {
            Button("Take Photo") { showCamera = true }
            Button("Choose from Library") { showLibrary = true }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(isPresented: $showLibrary, selection: $photoItem, matching: .images)
        .fullScreenCover(isPresented: $showCamera) {
            CameraCaptureView(onCapture: { data in viewModel.photoData = data })
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showServicePicker) {
            ServicePickerView(onSelect: { viewModel.selectedService = $0 })
                .environment(appState)
                .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Single-screen form

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                // Address header
                VStack(alignment: .leading, spacing: 2) {
                    if let (street, region) = splitAddress {
                        Text(street)
                            .font(.system(size: 15))
                            .foregroundStyle(D2DColor.muted)
                        Text(region)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(D2DColor.ink)
                    } else {
                        Text(viewModel.addressLine.isEmpty ? "Address pending" : viewModel.addressLine)
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(viewModel.addressLine.isEmpty ? D2DColor.muted : D2DColor.ink)
                    }
                }

                // Disposition grid
                VStack(alignment: .leading, spacing: 10) {
                    Text("DISPOSITION")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(D2DColor.soft)
                        .tracking(0.5)
                    DispositionPicker(
                        selected: $viewModel.selectedDisposition,
                        onSelect: { viewModel.selectDisposition($0) },
                        saleLabel: saleLabel,
                        saleDisposition: saleDisposition
                    )
                }

                // SIGN-UP: pick a service when this is a sale
                if viewModel.isSale {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("SIGN UP TO A SERVICE")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(D2DColor.soft)
                            .tracking(0.5)
                        Button { showServicePicker = true } label: { servicePlanCard }
                            .buttonStyle(.plain)
                    }
                    .transition(.opacity)
                }

                // Customer capture — shown for lead-type dispositions
                if viewModel.capturesLead {
                    VStack(spacing: 12) {
                        if viewModel.isSale {
                            Text("CUSTOMER DETAILS")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(D2DColor.soft)
                                .tracking(0.5)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        fieldBox {
                            TextField("Full name", text: $viewModel.givenName)
                                .textContentType(.name)
                        }
                        fieldBox {
                            TextField("Phone", text: $viewModel.phone)
                                .keyboardType(.phonePad)
                                .textContentType(.telephoneNumber)
                        }
                        if viewModel.isSale {
                            fieldBox {
                                TextField("Email", text: $viewModel.email)
                                    .keyboardType(.emailAddress)
                                    .textContentType(.emailAddress)
                                    .autocapitalization(.none)
                            }
                        }
                        // Non-sale contactable lead: capture explicit consent (a
                        // signed sale records consent via the signature instead).
                        if !viewModel.isSale {
                            Toggle(isOn: $viewModel.consentGiven) {
                                Text("I have consent to contact this person")
                                    .font(.system(size: 13))
                                    .foregroundStyle(D2DColor.muted)
                            }
                            .tint(D2DColor.accent)
                            .padding(.vertical, 2)
                        }
                        HStack(spacing: 12) {
                            Button {
                                if CameraCaptureView.isCameraAvailable { photoDialog = true } else { showLibrary = true }
                            } label: {
                                secondaryButton(icon: viewModel.hasPhoto ? "checkmark.circle.fill" : "camera",
                                                title: viewModel.hasPhoto ? "Photo added" : "Photo")
                            }
                            Button { showSignature = true } label: {
                                secondaryButton(icon: viewModel.hasSignature ? "checkmark.circle.fill" : "signature",
                                                title: viewModel.hasSignature ? "Signed" : "Sign")
                            }
                        }
                    }
                    .transition(.opacity)
                }

                // Save / Complete sign-up
                Button { viewModel.commit() } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 14, weight: .bold))
                        Text(saveTitle)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(saveEnabled ? D2DColor.hero : D2DColor.soft,
                               in: RoundedRectangle(cornerRadius: D2DRadius.md))
                }
                .disabled(!saveEnabled)
            }
            .padding(D2DSpacing.lg)
            .padding(.bottom, 24)
            .animation(.spring(duration: 0.25), value: viewModel.capturesLead)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var savingView: some View {
        VStack(spacing: 16) {
            ProgressView().scaleEffect(1.5)
            Text("Saving knock…")
                .font(.system(size: 14))
                .foregroundStyle(D2DColor.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(48)
    }

    private var errorView: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "exclamationmark.arrow.circlepath")
                .font(.system(size: 40)).foregroundStyle(D2DColor.warn)
            VStack(spacing: 6) {
                Text("Couldn't save").font(.system(size: 20, weight: .bold)).foregroundStyle(D2DColor.ink)
                Text(viewModel.errorMessage ?? "Your work is kept. Try again.")
                    .font(.system(size: 14)).foregroundStyle(D2DColor.muted).multilineTextAlignment(.center)
            }
            Button { viewModel.retry() } label: {
                Text("Retry").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).frame(height: 52)
                    .background(D2DColor.hero, in: RoundedRectangle(cornerRadius: D2DRadius.md))
            }
            Button("Back to knock") { viewModel.step = .disposition }
                .font(.system(size: 14)).foregroundStyle(D2DColor.muted)
            Spacer()
        }
        .padding(D2DSpacing.lg)
    }

    private func fieldBox<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .font(.system(size: 16))
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: D2DRadius.md))
            .overlay(RoundedRectangle(cornerRadius: D2DRadius.md).strokeBorder(D2DColor.line, lineWidth: 1))
    }

    private func secondaryButton(icon: String, title: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 14))
            Text(title).font(.system(size: 14, weight: .medium))
        }
        .foregroundStyle(D2DColor.ink)
        .frame(maxWidth: .infinity)
        .frame(height: 48)
        .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: D2DRadius.md))
        .overlay(RoundedRectangle(cornerRadius: D2DRadius.md).strokeBorder(D2DColor.line, lineWidth: 1))
    }

    // MARK: - Sign-up helpers

    private var servicePlanCard: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(D2DColor.accentSoft).frame(width: 40, height: 40)
                Image(systemName: viewModel.selectedService == nil ? "square.grid.2x2" : "checkmark.seal.fill")
                    .font(.system(size: 17))
                    .foregroundStyle(D2DColor.accent)
            }
            VStack(alignment: .leading, spacing: 2) {
                if let s = viewModel.selectedService {
                    Text(s.name).font(.system(size: 15, weight: .semibold)).foregroundStyle(D2DColor.ink)
                    Text(s.priceLabel).font(.system(size: 13)).foregroundStyle(D2DColor.muted)
                } else {
                    Text("Choose a plan").font(.system(size: 15, weight: .semibold)).foregroundStyle(D2DColor.ink)
                    Text("Tap to select a service").font(.system(size: 13)).foregroundStyle(D2DColor.muted)
                }
            }
            Spacer()
            Text(viewModel.selectedService == nil ? "Choose" : "Change")
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(D2DColor.accent)
        }
        .padding(14)
        .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: D2DRadius.md))
        .overlay(RoundedRectangle(cornerRadius: D2DRadius.md)
            .strokeBorder(viewModel.selectedService == nil ? D2DColor.line : D2DColor.accent.opacity(0.5),
                          lineWidth: viewModel.selectedService == nil ? 1 : 1.5))
    }

    private var saveTitle: String {
        if viewModel.isSale, let s = viewModel.selectedService { return "Complete sign-up · \(s.priceLabel)" }
        return "Save knock"
    }

    private var saveEnabled: Bool {
        guard viewModel.selectedDisposition != nil else { return false }
        if viewModel.isSale {
            // A "signed" sale must have a plan, a named customer, and a signature
            // (consent). Anything less is an unbillable / non-compliant record.
            return viewModel.selectedService != nil
                && !viewModel.givenName.trimmingCharacters(in: .whitespaces).isEmpty
                && viewModel.hasSignature
        }
        // A contactable lead that captured a phone number must carry consent.
        if viewModel.capturesLead && !viewModel.phone.trimmingCharacters(in: .whitespaces).isEmpty {
            return viewModel.consentGiven
        }
        return true
    }

    // MARK: - Org-configurable conversion tile (charity → DONOR, commercial → SALE)

    private var isCharity: Bool { CatalogStore.shared.offerings.first?.vertical == "charity" }
    private var saleLabel: String { isCharity ? "DONOR" : "SALE" }
    private var saleDisposition: KnockDisposition { isCharity ? .convertedDonation : .convertedSale }

    /// Best-effort split of the geocoded address into a street line + city/state line.
    private var splitAddress: (String, String)? {
        let parts = viewModel.addressLine.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count >= 2 else { return nil }
        return (parts[0], parts.dropFirst().joined(separator: ", "))
    }

    private func reverseGeocode() {
        let geocoder = CLGeocoder()
        let loc = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let coordFallback = String(format: "%.5f, %.5f", coordinate.latitude, coordinate.longitude)
        // In a dead zone CLGeocoder never returns — never leave the header on a
        // spinner. After 4s with no address, show the coordinates so the rep can
        // still knock; the geocoder result replaces them if/when it lands.
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            if viewModel.addressLine.isEmpty { viewModel.addressLine = coordFallback }
        }
        geocoder.reverseGeocodeLocation(loc) { placemarks, _ in
            guard let pm = placemarks?.first else {
                if viewModel.addressLine.isEmpty || viewModel.addressLine == coordFallback {
                    viewModel.addressLine = coordFallback
                }
                return
            }
            let street = [pm.subThoroughfare, pm.thoroughfare].compactMap { $0 }.joined(separator: " ")
            let region = [pm.locality, pm.administrativeArea, pm.postalCode].compactMap { $0 }.joined(separator: " ")
            let joined = [street, region].filter { !$0.isEmpty }.joined(separator: ", ")
            viewModel.addressLine = joined.isEmpty ? coordFallback : joined
        }
    }
}

// MARK: - Done state

struct KnockSavedView: View {
    let knock: Knock?
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            ZStack {
                Circle()
                    .fill(knock?.disposition.color.opacity(0.12) ?? D2DColor.success.opacity(0.12))
                    .frame(width: 80, height: 80)
                Image(systemName: "checkmark")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(knock?.disposition.color ?? D2DColor.success)
            }
            .symbolEffect(.bounce, value: knock != nil)

            VStack(spacing: 6) {
                Text("Knock saved")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(D2DColor.ink)
                if let knock {
                    Text(knock.disposition.displayName)
                        .font(.system(size: 14))
                        .foregroundStyle(knock.disposition.color)
                    if !knock.addressLine.isEmpty {
                        Text(knock.addressLine)
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                    }
                }
                Text("Syncing in background")
                    .font(.system(size: 12))
                    .foregroundStyle(D2DColor.soft)
            }
            .multilineTextAlignment(.center)

            Button(action: onDismiss) {
                Text("Done")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(D2DColor.accent, in: RoundedRectangle(cornerRadius: D2DRadius.md))
            }
            Spacer()
        }
    }
}
