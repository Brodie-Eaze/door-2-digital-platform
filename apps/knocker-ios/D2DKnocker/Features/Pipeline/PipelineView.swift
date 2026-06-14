// PipelineView.swift — the rep's book of business: Leads captured + Sales closed.
// Tab replaces Inbox. Leads can be added manually and signed up to a service.

import SwiftUI
import SwiftData

struct PipelineView: View {
    enum Segment: String, CaseIterable { case leads = "Leads", sales = "Sales" }

    @Environment(AppState.self) private var appState
    @State private var segment: Segment = .leads
    @State private var showAddLead = false

    @Query(sort: \Lead.createdAt, order: .reverse) private var leads: [Lead]
    @Query(sort: \Sale.createdAt, order: .reverse) private var sales: [Sale]

    private var todaySales: [Sale] {
        let start = Calendar.current.startOfDay(for: Date())
        return sales.filter { $0.createdAt >= start }
    }
    private var salesTotalCents: Int { todaySales.reduce(0) { $0 + $1.amountCents } }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $segment) {
                    ForEach(Segment.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                ScrollView {
                    if segment == .leads { leadsSection } else { salesSection }
                }
                .background(D2DColor.paper)
            }
            .background(D2DColor.paper)
            .navigationTitle("Pipeline")
            .toolbar {
                if segment == .leads {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showAddLead = true } label: { Image(systemName: "plus") }
                    }
                }
            }
            .sheet(isPresented: $showAddLead) { AddLeadView(orgId: appState.orgId) }
        }
    }

    // MARK: - Leads

    private var leadsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            summary(count: leads.count, label: leads.count == 1 ? "lead" : "leads", money: nil)
            if leads.isEmpty {
                emptyState(icon: "person.crop.circle.badge.plus",
                           text: "No leads yet. Capture a lead at the door, or tap + to add one.")
            } else {
                D2DCard(padded: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(leads.enumerated()), id: \.element.id) { idx, lead in
                            NavigationLink { LeadDetailView(lead: lead) } label: { LeadRow(lead: lead) }
                                .buttonStyle(.plain)
                            if idx < leads.count - 1 { Divider().padding(.leading, 60) }
                        }
                    }
                }
            }
        }
        .padding(16)
    }

    // MARK: - Sales

    private var salesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            summary(count: sales.count, label: sales.count == 1 ? "sale" : "sales",
                    money: Self.dollars(salesTotalCents))
            if sales.isEmpty {
                emptyState(icon: "checkmark.seal",
                           text: "No sales yet. Pick SALE at a door and sign a customer up to a service.")
            } else {
                D2DCard(padded: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(sales.enumerated()), id: \.element.id) { idx, sale in
                            NavigationLink { SaleDetailView(sale: sale) } label: { SaleRow(sale: sale) }
                                .buttonStyle(.plain)
                            if idx < sales.count - 1 { Divider().padding(.leading, 60) }
                        }
                    }
                }
            }
        }
        .padding(16)
    }

    private func summary(count: Int, label: String, money: String?) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(count) \(label)")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(D2DColor.ink)
                if let money {
                    Text("\(money) signed today")
                        .font(.system(size: 13)).foregroundStyle(D2DColor.muted)
                }
            }
            Spacer()
        }
    }

    private func emptyState(icon: String, text: String) -> some View {
        D2DCard {
            VStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 28)).foregroundStyle(D2DColor.soft)
                Text(text).font(.system(size: 13)).foregroundStyle(D2DColor.muted)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 22)
        }
    }

    static func dollars(_ cents: Int) -> String {
        let f = NumberFormatter(); f.numberStyle = .currency; f.locale = Locale(identifier: "en_US")
        f.maximumFractionDigits = (cents % 100 == 0) ? 0 : 2
        return f.string(from: NSNumber(value: Double(cents) / 100.0)) ?? "$0"
    }
}

// MARK: - Rows

private struct LeadRow: View {
    let lead: Lead
    var body: some View {
        HStack(spacing: 12) {
            avatar(initials: initials, tint: D2DColor.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 15, weight: .semibold)).foregroundStyle(D2DColor.ink)
                Text(lead.phone.isEmpty ? "No phone" : lead.phone)
                    .font(.system(size: 13)).foregroundStyle(D2DColor.muted)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(D2DColor.soft)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Lead: \(name), \(lead.phone.isEmpty ? "no phone" : lead.phone)")
        .accessibilityHint("Opens lead details")
    }
    private var name: String { [lead.givenName, lead.familyName].filter { !$0.isEmpty }.joined(separator: " ") }
    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

private struct SaleRow: View {
    let sale: Sale
    var body: some View {
        HStack(spacing: 12) {
            avatar(initials: initials, tint: D2DColor.success)
            VStack(alignment: .leading, spacing: 2) {
                Text(sale.customerName).font(.system(size: 15, weight: .semibold)).foregroundStyle(D2DColor.ink)
                Text(sale.serviceName).font(.system(size: 13)).foregroundStyle(D2DColor.muted)
            }
            Spacer()
            Text(sale.amountLabel)
                .font(.system(size: 15, weight: .bold)).foregroundStyle(D2DColor.success)
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(D2DColor.soft)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Sale: \(sale.customerName), \(sale.serviceName), \(sale.amountLabel)")
        .accessibilityHint("Opens sale details")
    }
    private var initials: String {
        let parts = sale.customerName.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

private func avatar(initials: String, tint: Color) -> some View {
    RoundedRectangle(cornerRadius: 9).fill(tint.opacity(0.12))
        .frame(width: 36, height: 36)
        .overlay(Text(initials.isEmpty ? "?" : initials).font(.system(size: 13, weight: .bold)).foregroundStyle(tint))
}

// MARK: - Sync payload helpers (Pipeline-created leads + sales)

enum PipelineSync {
    static func leadPayload(_ lead: Lead) -> String {
        json([
            "knockId": lead.knockId.uuidString, "orgId": lead.orgId,
            "givenName": lead.givenName, "familyName": lead.familyName,
            "phone": lead.phone, "email": lead.email, "bestCallTime": lead.bestCallTime,
            "vertical": lead.vertical, "notes": lead.notes, "consentGiven": lead.consentGiven,
            "idempotencyKey": "lead-" + lead.id.uuidString,
        ])
    }
    static func salePayload(_ sale: Sale) -> String {
        var d: [String: Any] = [
            "knockId": sale.knockId.uuidString, "orgId": sale.orgId,
            "customerName": sale.customerName, "customerPhone": sale.customerPhone,
            "customerEmail": sale.customerEmail, "addressLine": sale.addressLine,
            "serviceId": sale.serviceId, "serviceName": sale.serviceName,
            "amountCents": sale.amountCents, "frequency": sale.frequencyRaw,
            "signedAt": ISO8601DateFormatter().string(from: sale.signedAt),
            "idempotencyKey": "sale-" + sale.id.uuidString,
        ]
        if let lid = sale.leadId { d["leadId"] = lid.uuidString }
        if let s = sale.signatureLocalPath { d["signatureKey"] = (s as NSString).lastPathComponent }
        return json(d)
    }
    private static func json(_ dict: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let str = String(data: data, encoding: .utf8) else { return "{}" }
        return str
    }
}

// MARK: - Add lead (manual capture)

struct AddLeadView: View {
    let orgId: String
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Lead") {
                    TextField("Full name", text: $name).textContentType(.name)
                    TextField("Phone", text: $phone).keyboardType(.phonePad)
                    TextField("Email", text: $email).keyboardType(.emailAddress).autocapitalization(.none)
                }
                Section("Notes") {
                    TextField("What did they say?", text: $notes, axis: .vertical).lineLimit(3...6)
                }
            }
            .navigationTitle("Add lead")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { save() }.disabled(name.isEmpty && phone.isEmpty)
                }
            }
        }
    }

    private func save() {
        let parts = name.split(separator: " ", maxSplits: 1).map(String.init)
        let lead = Lead(knockId: UUID(), orgId: orgId,
                        givenName: parts.first ?? name,
                        familyName: parts.count > 1 ? parts[1] : "",
                        phone: phone, email: email, notes: notes)
        context.insert(lead)
        context.insert(PendingSync(operationType: .createLead, entityId: lead.id,
                                   payloadJSON: PipelineSync.leadPayload(lead),
                                   idempotencyKey: "lead-" + lead.id.uuidString))
        try? context.save()
        dismiss()
    }
}

// MARK: - Lead detail (call / sign up)

struct LeadDetailView: View {
    let lead: Lead
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var context
    @State private var showServicePicker = false
    @State private var signedSale: Sale?

    private var name: String { [lead.givenName, lead.familyName].filter { !$0.isEmpty }.joined(separator: " ") }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                D2DCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(name.isEmpty ? "Lead" : name)
                            .font(.system(size: 20, weight: .bold)).foregroundStyle(D2DColor.ink)
                        if !lead.phone.isEmpty { detail("Phone", lead.phone) }
                        if !lead.email.isEmpty { detail("Email", lead.email) }
                        if !lead.notes.isEmpty { detail("Notes", lead.notes) }
                        detail("Captured", lead.createdAt.formatted(date: .abbreviated, time: .shortened))
                    }
                }

                if let sale = signedSale {
                    D2DCard {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.seal.fill").foregroundStyle(D2DColor.success)
                            VStack(alignment: .leading) {
                                Text("Signed up to \(sale.serviceName)").font(.system(size: 14, weight: .semibold))
                                Text(sale.amountLabel).font(.system(size: 13)).foregroundStyle(D2DColor.muted)
                            }
                            Spacer()
                        }
                    }
                } else {
                    Button { showServicePicker = true } label: {
                        Label("Sign up to a service", systemImage: "checkmark.seal")
                            .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).frame(height: 52)
                            .background(D2DColor.hero, in: RoundedRectangle(cornerRadius: D2DRadius.md))
                    }
                }
            }
            .padding(16)
        }
        .background(D2DColor.paper)
        .navigationTitle("Lead")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showServicePicker) {
            ServicePickerView(onSelect: { signUp(to: $0) })
                .environment(appState)
                .presentationDetents([.medium, .large])
        }
    }

    private func detail(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased()).font(.system(size: 10, weight: .semibold)).foregroundStyle(D2DColor.soft)
            Text(value).font(.system(size: 15)).foregroundStyle(D2DColor.ink)
        }
    }

    private func signUp(to service: ServiceOffering) {
        let sale = Sale(knockId: lead.knockId, leadId: lead.id, orgId: lead.orgId,
                        customerName: name.isEmpty ? "Customer" : name,
                        customerPhone: lead.phone, customerEmail: lead.email, addressLine: "",
                        serviceId: service.id, serviceName: service.name,
                        amountCents: service.priceCents, frequencyRaw: service.frequency.rawValue)
        context.insert(sale)
        context.insert(PendingSync(operationType: .createSale, entityId: sale.id,
                                   payloadJSON: PipelineSync.salePayload(sale),
                                   idempotencyKey: "sale-" + sale.id.uuidString))
        try? context.save()
        signedSale = sale
    }
}

// MARK: - Sale detail

struct SaleDetailView: View {
    let sale: Sale

    private var signatureImage: UIImage? {
        guard let path = sale.signatureLocalPath else { return nil }
        // Stored as an absolute path or a Documents-relative filename.
        if let img = UIImage(contentsOfFile: path) { return img }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        if let docs, let img = UIImage(contentsOfFile: docs.appendingPathComponent((path as NSString).lastPathComponent).path) {
            return img
        }
        return nil
    }

    private var syncTone: Color {
        switch sale.syncStatusRaw {
        case "synced": return D2DColor.success
        case "failed": return D2DColor.warn
        default:       return D2DColor.muted
        }
    }
    private var syncLabel: String {
        switch sale.syncStatusRaw {
        case "synced": return "Synced to server"
        case "failed": return "Sync failed — will retry"
        default:       return "Queued to sync"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Headline: amount + service
                D2DCard {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(sale.amountLabel)
                            .font(.system(size: 30, weight: .bold)).foregroundStyle(D2DColor.success)
                            .accessibilityLabel("Amount \(sale.amountLabel)")
                        Text(sale.serviceName)
                            .font(.system(size: 16, weight: .semibold)).foregroundStyle(D2DColor.ink)
                        HStack(spacing: 6) {
                            Circle().fill(syncTone).frame(width: 8, height: 8)
                            Text(syncLabel).font(.system(size: 13)).foregroundStyle(D2DColor.muted)
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel(syncLabel)
                    }
                }

                // Customer
                D2DCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("CUSTOMER").font(.system(size: 10, weight: .semibold)).foregroundStyle(D2DColor.soft)
                        detail("Name", sale.customerName)
                        if !sale.customerPhone.isEmpty { detail("Phone", sale.customerPhone) }
                        if !sale.customerEmail.isEmpty { detail("Email", sale.customerEmail) }
                        if !sale.addressLine.isEmpty { detail("Address", sale.addressLine) }
                    }
                }

                // Evidence
                D2DCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("EVIDENCE").font(.system(size: 10, weight: .semibold)).foregroundStyle(D2DColor.soft)
                        detail("Signed", sale.signedAt.formatted(date: .abbreviated, time: .shortened))
                        detail("Frequency", sale.frequency.label)
                        if let img = signatureImage {
                            Image(uiImage: img).resizable().scaledToFit()
                                .frame(maxWidth: .infinity).frame(height: 120)
                                .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: D2DRadius.sm))
                                .overlay(RoundedRectangle(cornerRadius: D2DRadius.sm).stroke(D2DColor.line))
                                .accessibilityLabel("Customer signature")
                        } else {
                            Text("No signature on file").font(.system(size: 13)).foregroundStyle(D2DColor.muted)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(D2DColor.paper)
        .navigationTitle("Sale")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func detail(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased()).font(.system(size: 10, weight: .semibold)).foregroundStyle(D2DColor.soft)
            Text(value).font(.system(size: 15)).foregroundStyle(D2DColor.ink)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}
