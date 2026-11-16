// «سفرتنا» on the home and lock screen (16 Nov 2026, App Review 4.2.6):
// the next prayer where you are and the next stop of today's plan.
//
// No network and no location here: the app writes the data to the shared
// app group (AppDelegate.swift, `WidgetFeed`) whenever it opens or a plan is
// kept or removed. One timeline entry per prayer, so the widget moves on to
// the next prayer by itself for three days.

import SwiftUI
import WidgetKit

struct Feed: Decodable {
    struct Prayer: Decodable { let at: Double; let name: String; let clock: String }
    struct Stop: Decodable { let time: String; let name: String }
    struct Day: Decodable { let date: String; let city: String; let stops: [Stop] }
    let lang: String
    let place: String
    let prayers: [Prayer]
    let days: [Day]

    static func read() -> Feed? {
        guard let data = UserDefaults(suiteName: "group.com.sfrtna.app")?.data(forKey: "widget.feed") else { return nil }
        return try? JSONDecoder().decode(Feed.self, from: data)
    }

    var english: Bool { lang == "en" }
    func t(_ ar: String, _ en: String) -> String { english ? en : ar }

    func nextPrayer(after now: Date) -> Prayer? { prayers.first { $0.at > now.timeIntervalSince1970 } }

    /// Today's day of a kept plan and its next stops (all of them before the first one).
    func today(_ now: Date) -> (city: String, stops: [Stop])? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        let date = f.string(from: now)
        guard let day = days.first(where: { $0.date == date }) else { return nil }
        f.dateFormat = "HH:mm"
        let clock = f.string(from: now)
        let ahead = day.stops.filter { $0.time >= clock }
        return (day.city, ahead)
    }

    /// The next day of a kept plan (a trip that has not started yet).
    func nextTrip(_ now: Date) -> Day? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        let date = f.string(from: now)
        return days.first { $0.date > date }
    }
}

struct Entry: TimelineEntry {
    let date: Date
    let feed: Feed?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: Date(), feed: nil) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), feed: Feed.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let feed = Feed.read()
        let now = Date()
        var dates = [now]
        // Right after each prayer (the next one shows) and each half hour of
        // the day (today's next stop moves on).
        for p in feed?.prayers ?? [] where p.at > now.timeIntervalSince1970 {
            dates.append(Date(timeIntervalSince1970: p.at + 60))
        }
        for i in 1...12 { dates.append(now.addingTimeInterval(Double(i) * 1800)) }
        let entries = Array(Set(dates)).sorted().prefix(60).map { Entry(date: $0, feed: feed) }
        let end = entries.last?.date ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: entries, policy: .after(end)))
    }
}

private let navy = Color(red: 0x0B / 255, green: 0x2D / 255, blue: 0x5B / 255)
private let gold = Color(red: 0xF8 / 255, green: 0xB8 / 255, blue: 0x40 / 255)

struct SfrtnaWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        let feed = entry.feed
        let dir: LayoutDirection = feed?.english == true ? .leftToRight : .rightToLeft
        content(feed)
            .environment(\.layoutDirection, dir)
            .widgetBackground(family == .accessoryInline || family == .accessoryRectangular || family == .accessoryCircular ? Color.clear : navy)
    }

    @ViewBuilder
    private func content(_ feed: Feed?) -> some View {
        switch family {
        case .accessoryInline: inline(feed)
        case .accessoryRectangular: rectangular(feed)
        case .systemMedium: medium(feed)
        default: small(feed)
        }
    }

    // MARK: Lock screen

    private func inline(_ feed: Feed?) -> some View {
        guard let feed = feed, let p = feed.nextPrayer(after: entry.date) else {
            return Text("🕌 سفرتنا")
        }
        return Text("🕌 \(p.name) \(p.clock)")
    }

    private func rectangular(_ feed: Feed?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let feed = feed, let p = feed.nextPrayer(after: entry.date) {
                Text("🕌 \(p.name) \(p.clock)").font(.headline).widgetAccentable()
                if let stop = feed.today(entry.date)?.stops.first {
                    Text("\(stop.time) · \(stop.name)").font(.caption).lineLimit(1)
                } else {
                    Text(Date(timeIntervalSince1970: p.at), style: .relative).font(.caption)
                }
            } else {
                Text("🕌 سفرتنا").font(.headline)
                Text("افتح التطبيق مرة لتظهر أوقات الصلاة").font(.caption).lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Home screen

    private func prayerBlock(_ feed: Feed?) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            if let feed = feed, let p = feed.nextPrayer(after: entry.date) {
                Text(feed.t("الصلاة القادمة", "Next prayer")).font(.caption2).foregroundColor(.white.opacity(0.7))
                Text("🕌 \(p.name)").font(.headline).foregroundColor(.white)
                Text(p.clock).font(.system(size: 30, weight: .bold, design: .rounded)).foregroundColor(gold)
                Text(Date(timeIntervalSince1970: p.at), style: .relative).font(.caption2).foregroundColor(.white.opacity(0.8))
                if !feed.place.isEmpty {
                    Text("📍 \(feed.place)").font(.caption2).foregroundColor(.white.opacity(0.7)).lineLimit(1)
                }
            } else {
                Text("🕌 سفرتنا").font(.headline).foregroundColor(.white)
                Text("افتح التطبيق مرة لتظهر أوقات الصلاة حيث أنت")
                    .font(.caption).foregroundColor(.white.opacity(0.8)).lineLimit(3)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func small(_ feed: Feed?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            prayerBlock(feed)
            Spacer(minLength: 0)
            if let feed = feed, let stop = feed.today(entry.date)?.stops.first {
                Text("\(stop.time) · \(stop.name)").font(.caption2.bold()).foregroundColor(.white).lineLimit(1)
            }
        }
    }

    private func medium(_ feed: Feed?) -> some View {
        HStack(alignment: .top, spacing: 12) {
            prayerBlock(feed)
            Rectangle().fill(Color.white.opacity(0.2)).frame(width: 1)
            tripBlock(feed)
        }
    }

    private func tripBlock(_ feed: Feed?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if let feed = feed, let today = feed.today(entry.date) {
                Text(feed.t("اليوم في \(today.city)", "Today in \(today.city)")).font(.caption2).foregroundColor(.white.opacity(0.7)).lineLimit(1)
                if today.stops.isEmpty {
                    Text(feed.t("انتهت محطات اليوم ✓", "Today's stops are done ✓")).font(.caption).foregroundColor(.white)
                }
                ForEach(Array(today.stops.prefix(3).enumerated()), id: \.offset) { _, stop in
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(stop.time).font(.caption.bold()).foregroundColor(gold)
                        Text(stop.name).font(.caption).foregroundColor(.white).lineLimit(1)
                    }
                }
            } else if let feed = feed, let next = feed.nextTrip(entry.date) {
                Text(feed.t("رحلتك القادمة", "Your next trip")).font(.caption2).foregroundColor(.white.opacity(0.7))
                Text("✈️ \(next.city)").font(.headline).foregroundColor(.white).lineLimit(1)
                Text(next.date).font(.caption).foregroundColor(gold)
            } else {
                Text(feed?.t("لا خطة اليوم", "No plan today") ?? "لا خطة اليوم").font(.caption2).foregroundColor(.white.opacity(0.7))
                Text(feed?.t("صمّم رحلتك من تبويب «خطّط» واحفظها على جوالك", "Build a trip in the Plan tab and keep it on your phone")
                     ?? "صمّم رحلتك من تبويب «خطّط» واحفظها على جوالك")
                    .font(.caption).foregroundColor(.white).lineLimit(4)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension View {
    /// iOS 17 wants the background declared; earlier versions draw it.
    @ViewBuilder
    func widgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            padding().background(color)
        }
    }
}

@main
struct SfrtnaWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SfrtnaToday", provider: Provider()) { entry in
            SfrtnaWidgetView(entry: entry)
        }
        .configurationDisplayName("سفرتنا · Sfrtna")
        .description("الصلاة القادمة حيث أنت، ومحطتك التالية في خطة اليوم.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
