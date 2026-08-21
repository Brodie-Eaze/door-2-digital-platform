// LeadFormView.swift — fast 3-field lead capture (name, phone, callback time).
// Required for: callback, appointment, convertedSale, convertedDonation.

import SwiftUI

struct LeadFormView: View {
    @Binding var givenName: String
    @Binding var familyName: String
    @Binding var phone: String
    @Binding var email: String
    @Binding var consentGiven: Bool

    let disposition: KnockDisposition
    let onProceed: () -> Void

    @FocusState private var focus: Field?
    @State private var showExpanded = false

    enum Field { case givenName, familyName, phone, email }

    var canProceed: Bool {
        !givenName.trimmingCharacters(in: .whitespaces).isEmpty ||
        !phone.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 8) {
                Circle()
                    .fill(disposition.color.opacity(0.15))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Image(systemName: disposition.systemImage)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(disposition.color)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(disposition.displayName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                    Text("Capture contact details")
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.muted)
                }
            }

            // Core fields
            VStack(spacing: 10) {
                // Name row
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("First name", systemImage: "person")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(D2DColor.ink2)
                            .labelStyle(.titleOnly)
                        TextField("First", text: $givenName)
                            .textContentType(.givenName)
                            .submitLabel(.next)
                            .focused($focus, equals: .givenName)
                            .onSubmit { focus = .familyName }
                            .compactFieldStyle()
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Last name")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(D2DColor.ink2)
                        TextField("Last", text: $familyName)
                            .textContentType(.familyName)
                            .submitLabel(.next)
                            .focused($focus, equals: .familyName)
                            .onSubmit { focus = .phone }
                            .compactFieldStyle()
                    }
                }

                // Phone
                VStack(alignment: .leading, spacing: 4) {
                    Text("Phone")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(D2DColor.ink2)
                    TextField("+1 555 000 0000", text: $phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .focused($focus, equals: .phone)
                        .compactFieldStyle()
                }
            }

            // Expand for email
            Button {
                withAnimation { showExpanded.toggle() }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 12))
                    Text(showExpanded ? "Less fields" : "Add email")
                        .font(.system(size: 12))
                }
                .foregroundStyle(D2DColor.accent)
            }

            if showExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Email")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(D2DColor.ink2)
                    TextField("name@email.com", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .compactFieldStyle()
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            // Consent toggle — required for contactable leads
            VStack(alignment: .leading, spacing: 6) {
                Toggle(isOn: $consentGiven) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Consent to contact")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(D2DColor.ink)
                        Text("They agree to be contacted by phone/email/SMS")
                            .font(.system(size: 11))
                            .foregroundStyle(D2DColor.muted)
                    }
                }
                .tint(D2DColor.accent)

                if consentGiven {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(D2DColor.success)
                            .font(.system(size: 11))
                        Text("Verbal consent captured at \(formattedTime)")
                            .font(.system(size: 10))
                            .foregroundStyle(D2DColor.success)
                    }
                }
            }
            .padding(12)
            .background(consentGiven ? D2DColor.success.opacity(0.08) : D2DColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: D2DRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: D2DRadius.md)
                    .strokeBorder(consentGiven ? D2DColor.success.opacity(0.3) : D2DColor.line, lineWidth: 1)
            )

            // Proceed button
            Button(action: onProceed) {
                Text(disposition.requiresSignature ? "Next: Signature" : "Save Knock")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(
                        canProceed ? D2DColor.accent : D2DColor.soft,
                        in: RoundedRectangle(cornerRadius: D2DRadius.md)
                    )
            }
            .disabled(!canProceed)

            if !canProceed {
                Text("Enter at least a name or phone number to continue")
                    .font(.system(size: 11))
                    .foregroundStyle(D2DColor.muted)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }

    private var formattedTime: String {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: Date())
    }
}

// MARK: - Compact field style

private extension View {
    func compactFieldStyle() -> some View {
        self
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(D2DColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: D2DRadius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: D2DRadius.sm)
                    .strokeBorder(D2DColor.line, lineWidth: 1)
            )
            .font(.system(size: 14))
    }
}
