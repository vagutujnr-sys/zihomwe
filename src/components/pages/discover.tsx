"use client";

import { useState } from "react";
import {
  Search,
  MapPin,
  Clock,
  Users,
  Heart,
  Share2,
  Calendar,
  Filter,
  Zap,
} from "lucide-react";

// Mock Event Data
const allEvents = [
  {
    id: 1,
    title: "Community Cleanup Drive",
    category: "Community",
    date: "Saturday, 22 July",
    time: "08:00 AM",
    location: "Ward 12 Community Hall",
    address: "1562 Main Street, Budiriro",
    attending: 156,
    image: "https://picsum.photos/seed/event1/900/600",
    description: "Help us clean up our community spaces and make Ward 12 beautiful",
    live: true,
  },
  {
    id: 2,
    title: "Youth Skills Workshop",
    category: "Learning",
    date: "Wednesday, 26 July",
    time: "14:00 PM",
    location: "Glenview Youth Center",
    address: "456 Youth Road, Glenview",
    attending: 32,
    image: "https://picsum.photos/seed/event2/900/600",
    description: "Free technical training for young professionals. Learn in-demand skills.",
    live: false,
  },
  {
    id: 3,
    title: "Ward Development Meeting",
    category: "Governance",
    date: "Friday, 24 July",
    time: "18:00 PM",
    location: "Budiriro Community Hall",
    address: "789 Community Drive, Budiriro",
    attending: 78,
    image: "https://picsum.photos/seed/event3/900/600",
    description: "Quarterly meeting to discuss ward development priorities and community issues",
    live: false,
  },
  {
    id: 4,
    title: "Healthcare Awareness Clinic",
    category: "Health",
    date: "Sunday, 28 July",
    time: "09:00 AM",
    location: "Mbare Community Clinic",
    address: "321 Health Street, Mbare",
    attending: 120,
    image: "https://picsum.photos/seed/event4/900/600",
    description: "Free health screening and consultation with medical professionals",
    live: false,
  },
  {
    id: 5,
    title: "Women Entrepreneurs Network",
    category: "Business",
    date: "Thursday, 25 July",
    time: "17:00 PM",
    location: "Downtown Business Hub",
    address: "555 Enterprise Lane, Harare CBD",
    attending: 56,
    image: "https://picsum.photos/seed/event5/900/600",
    description: "Connect with other female entrepreneurs and explore business opportunities",
    live: false,
  },
  {
    id: 6,
    title: "School Holiday Program",
    category: "Learning",
    date: "Monday, 29 July",
    time: "10:00 AM",
    location: "Glenview Primary School",
    address: "222 Education Road, Glenview",
    attending: 89,
    image: "https://picsum.photos/seed/event6/900/600",
    description: "Safe holiday activities and mentoring for school-age children",
    live: false,
  },
];

const categories = [
  "All",
  "Community",
  "Learning",
  "Health",
  "Business",
  "Governance",
];

export function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [savedEvents, setSavedEvents] = useState<number[]>([]);

  const filteredEvents = allEvents.filter((event) => {
    const matchesCategory =
      activeCategory === "All" || event.category === activeCategory;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleSaveEvent = (eventId: number) => {
    setSavedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  return (
    <div className="space-y-6 pb-40 pt-2">
      {/* Header */}
      <div className="space-y-4 px-4 sm:px-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Discover Events</h1>
          <p className="mt-1 text-slate-600">Find what's happening around you</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search events or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm placeholder-slate-500 transition focus:border-green-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 px-4 sm:px-0">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition ${
              activeCategory === category
                ? "bg-green-700 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Events Scanner */}
      <div className="space-y-0 -mx-4 sm:mx-0">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-12 text-center">
            <Calendar className="mb-3 text-slate-400" size={32} />
            <p className="text-slate-600">No events found matching your search</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="overflow-hidden bg-white border-b border-slate-200 transition hover:shadow-md"
            >
              {/* Event Image with Live Badge */}
              <div className="relative h-56 overflow-hidden bg-slate-200">
                {event.live && (
                  <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                    <Zap size={12} />
                    Happening Now
                  </div>
                )}
                <img
                  src={event.image}
                  alt={event.title}
                  className="h-full w-full object-cover transition duration-300 hover:scale-105"
                />
              </div>

              {/* Event Details */}
              <div className="space-y-4 px-4 sm:px-4 py-4">
                {/* Category Badge */}
                <div className="inline-flex">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {event.category}
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-slate-900 line-clamp-2">
                  {event.title}
                </h2>

                {/* Date & Time */}
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-green-700" size={18} />
                    <div>
                      <p className="font-medium">{event.date}</p>
                      <p className="text-xs text-slate-500">{event.time}</p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <MapPin className="flex-shrink-0 text-green-700" size={18} />
                    <div>
                      <p className="font-medium">{event.location}</p>
                      <p className="text-xs text-slate-500">{event.address}</p>
                    </div>
                  </div>

                  {/* Attending */}
                  <div className="flex items-center gap-3">
                    <Users className="text-green-700" size={18} />
                    <p className="font-medium">{event.attending} people attending</p>
                  </div>
                </div>

                {/* Description */}
                <p className="line-clamp-2 text-sm text-slate-600">
                  {event.description}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-2 border-t border-slate-200 pt-4">
                  <button className="flex-1 rounded-full bg-green-700 py-3 text-sm font-semibold text-white transition hover:bg-green-800">
                    Join Event
                  </button>
                  <button
                    onClick={() => toggleSaveEvent(event.id)}
                    className={`flex items-center justify-center rounded-full px-4 py-3 transition ${
                      savedEvents.includes(event.id)
                        ? "bg-red-100 text-red-600"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Heart
                      size={20}
                      fill={savedEvents.includes(event.id) ? "currentColor" : "none"}
                    />
                  </button>
                  <button className="flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-slate-700 transition hover:bg-slate-50">
                    <Share2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Section */}
      <div className="rounded-2xl border border-slate-200 bg-green-50 p-6">
        <h3 className="font-semibold text-slate-900">Tip</h3>
        <p className="mt-2 text-sm text-slate-700">
          Events are sorted by date. Turn on location to see events closest to you first. Save your favorite events to keep track of them.
        </p>
      </div>
    </div>
  );
}
