// D2DKnockerTests.swift — Unit tests for the D2D Knocker iOS app.
// Run via Xcode Product > Test (Cmd+U) or via xcodebuild.

import XCTest
@testable import D2DKnocker
import SwiftData
import CoreLocation

final class D2DKnockerTests: XCTestCase {

    // MARK: - KnockDisposition

    func test_knockDisposition_requiresLeadForm() {
        XCTAssertTrue(KnockDisposition.convertedSale.requiresLeadForm)
        XCTAssertTrue(KnockDisposition.convertedDonation.requiresLeadForm)
        XCTAssertTrue(KnockDisposition.appointment.requiresLeadForm)
        XCTAssertTrue(KnockDisposition.callback.requiresLeadForm)
        XCTAssertFalse(KnockDisposition.noAnswer.requiresLeadForm)
        XCTAssertFalse(KnockDisposition.notInterested.requiresLeadForm)
        XCTAssertFalse(KnockDisposition.doNotKnock.requiresLeadForm)
        XCTAssertFalse(KnockDisposition.hostile.requiresLeadForm)
        XCTAssertFalse(KnockDisposition.invalidAddress.requiresLeadForm)
    }

    func test_knockDisposition_requiresSignature() {
        XCTAssertTrue(KnockDisposition.convertedSale.requiresSignature)
        XCTAssertTrue(KnockDisposition.convertedDonation.requiresSignature)
        XCTAssertFalse(KnockDisposition.callback.requiresSignature)
        XCTAssertFalse(KnockDisposition.appointment.requiresSignature)
        XCTAssertFalse(KnockDisposition.noAnswer.requiresSignature)
    }

    func test_knockDisposition_rawValues() {
        XCTAssertEqual(KnockDisposition.noAnswer.rawValue,          "no_answer")
        XCTAssertEqual(KnockDisposition.convertedSale.rawValue,     "converted_sale")
        XCTAssertEqual(KnockDisposition.convertedDonation.rawValue, "converted_donation")
        XCTAssertEqual(KnockDisposition.doNotKnock.rawValue,        "do_not_knock")
    }

    func test_knockDisposition_roundtrips() {
        for d in KnockDisposition.allCases {
            XCTAssertEqual(KnockDisposition(rawValue: d.rawValue), d, "Round-trip failed for \(d)")
        }
    }

    // MARK: - KnockFlowViewModel step transitions

    func test_flowViewModel_noAnswerGoesToSaving() {
        let vm = KnockFlowViewModel(coordinate: CLLocationCoordinate2D(latitude: 0, longitude: 0))
        vm.selectDisposition(.noAnswer)
        XCTAssertEqual(vm.step, .saving)
    }

    func test_flowViewModel_callbackStaysInlineAndCapturesLead() {
        // T1-1 one-tap redesign: lead/sale dispositions capture inline on the
        // single-screen sheet — no .leadForm hop. The rep fills the form in place.
        let vm = KnockFlowViewModel(coordinate: CLLocationCoordinate2D(latitude: 0, longitude: 0))
        vm.selectDisposition(.callback)
        XCTAssertEqual(vm.step, .disposition)
        XCTAssertTrue(vm.capturesLead)
    }

    func test_flowViewModel_callbackLeadFormGoesToSaving() {
        let vm = KnockFlowViewModel(coordinate: CLLocationCoordinate2D(latitude: 0, longitude: 0))
        vm.selectDisposition(.callback)
        vm.proceedFromLeadForm()
        XCTAssertEqual(vm.step, .saving)
    }

    func test_flowViewModel_convertedSaleCapturesInlineThenSignature() {
        // Sale: inline capture on the sheet, then signature, then saving.
        let vm = KnockFlowViewModel(coordinate: CLLocationCoordinate2D(latitude: 0, longitude: 0))
        vm.selectDisposition(.convertedSale)
        XCTAssertEqual(vm.step, .disposition)
        XCTAssertTrue(vm.capturesLead)
        vm.proceedFromLeadForm()
        XCTAssertEqual(vm.step, .signature)
        vm.proceedFromSignature()
        XCTAssertEqual(vm.step, .saving)
    }

    // MARK: - Knock model

    func test_knock_idempotencyKeyFormat() {
        let knock = Knock(
            sessionId:   "s1",
            orgId:       "o1",
            userId:      "u1",
            addressLine: "123 Main St",
            latitude:    37.7749,
            longitude:   -122.4194,
            disposition: .noAnswer
        )
        XCTAssertTrue(knock.idempotencyKey.hasPrefix("knock-"))
        XCTAssertEqual(knock.idempotencyKey, "knock-\(knock.id.uuidString.lowercased())")
    }

    func test_knock_syncStatus_defaultsPending() {
        let knock = Knock(
            sessionId:   "s1",
            orgId:       "o1",
            userId:      "u1",
            addressLine: "123 Main St",
            latitude:    0,
            longitude:   0,
            disposition: .noAnswer
        )
        XCTAssertEqual(knock.syncStatus, .pending)
    }

    func test_knock_disposition_roundtrip() {
        for d in KnockDisposition.allCases {
            let knock = Knock(
                sessionId: "s", orgId: "o", userId: "u",
                addressLine: "A", latitude: 0, longitude: 0, disposition: d
            )
            XCTAssertEqual(knock.disposition, d, "disposition round-trip failed for \(d)")
        }
    }

    // MARK: - PendingSync

    func test_pendingSync_isPendingWhenNotCompleted() {
        let ps = PendingSync(
            operationType: .createKnock,
            entityId: UUID(),
            payloadJSON: "{}",
            idempotencyKey: "knock-test"
        )
        XCTAssertTrue(ps.isPending)
        XCTAssertNil(ps.completedAt)
        XCTAssertEqual(ps.operationType, .createKnock)
    }

    // MARK: - Lead

    func test_lead_displayName() {
        let lead = Lead(
            knockId: UUID(),
            orgId: "org1",
            givenName: "Jane",
            familyName: "Smith",
            phone: "+1 555 000 0000"
        )
        XCTAssertEqual(lead.displayName, "Jane Smith")
    }

    func test_lead_consentTimestamp_setOnConsent() {
        let lead = Lead(
            knockId: UUID(),
            orgId: "org1",
            givenName: "Jane",
            familyName: "Smith",
            phone: "+1 555 000 0000",
            consentGiven: true
        )
        XCTAssertTrue(lead.consentGiven)
        XCTAssertNotNil(lead.consentTimestamp)
    }

    // MARK: - AppState

    func test_appState_signIn() {
        let state = AppState()
        let user = UserProfile(
            id: "u1",
            email: "t@test.com",
            givenName: "Test",
            familyName: "User",
            role: "knocker",
            orgId: "org1"
        )
        state.signIn(token: "tok123", user: user)
        XCTAssertTrue(state.isAuthenticated)
        XCTAssertEqual(state.accessToken, "tok123")
        XCTAssertEqual(state.currentUser, user)
        XCTAssertEqual(state.orgId, "org1")
    }

    func test_appState_signOut_clearsState() {
        let state = AppState()
        let user = UserProfile(id: "u1", email: "t@t.com", givenName: "T", familyName: "U", role: "knocker", orgId: "o1")
        state.signIn(token: "tok", user: user)
        state.knocksToday = 10
        state.conversionsToday = 3
        state.signOut()
        XCTAssertFalse(state.isAuthenticated)
        XCTAssertNil(state.currentUser)
        XCTAssertNil(state.accessToken)
        XCTAssertEqual(state.knocksToday, 0)
        XCTAssertEqual(state.conversionsToday, 0)
    }

    func test_appState_startShift() {
        let state = AppState()
        state.startShift(sessionId: "sess-abc")
        XCTAssertTrue(state.isOnShift)
        XCTAssertEqual(state.sessionId, "sess-abc")
        XCTAssertNotNil(state.shiftStartedAt)
    }
}
