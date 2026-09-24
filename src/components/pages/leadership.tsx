"use client";

import { useEffect, useState } from "react";
import type { LeadershipMember } from "@/lib/content";

function UserPlaceholder() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-16 w-16 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}


export function LeadershipPage() {
  const [isPresidentSpeaking, setIsPresidentSpeaking] = useState(false);
  const [leaders, setLeaders] = useState<LeadershipMember[]>([]);

  useEffect(() => {
    async function loadLeadership() {
      const mobileNumber = window.localStorage.getItem("zihomweUserPhone") ?? "";
      const response = await fetch(`/api/leadership?mobileNumber=${encodeURIComponent(mobileNumber)}`);
      const payload = await response.json();
      if (response.ok && payload.leadership) setLeaders([payload.leadership]);
    }

    void loadLeadership();
  }, []);

  const constituency = leaders[0]?.constituency || "Your constituency";
  const president = {
    name: "H.E. Emmerson Mnangagwa",
    role: "President of Zimbabwe",
    image:
      "https://i.guim.co.uk/img/media/69c4ec8d3c2d2f4f2b518b9865de61fa1a06bebc/0_140_3000_1800/master/3000.jpg?width=465&dpr=1&s=none&crop=5%3A4"
  };
  const mp = leaders[0];



  return (

    <div className="pb-20 -mx-4 sm:mx-0">


      {/* NATIONAL LEADERSHIP */}

      <section>


        <div className="w-full">

          <img
            src={president.image}
            alt={president.name}
            className="
              w-full
              h-[220px]
              sm:h-[280px]
              object-cover
              object-top
            "
          />

        </div>



        <div className="text-center px-4 sm:px-0 mt-8">


          <h1 className="text-3xl font-bold text-slate-900">
            {president.name}
          </h1>


          <p className="mt-2 text-green-700 font-semibold">
            {president.role}
          </p>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.speechSynthesis.cancel();
                setIsPresidentSpeaking(true);
                const utterance = new SpeechSynthesisUtterance("Your President Speaks");
                utterance.lang = "en-US";
                utterance.rate = 1;
                utterance.onend = () => {
                  setIsPresidentSpeaking(false);
                };
                window.speechSynthesis.speak(utterance);
              }
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(15,23,42,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-900"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Zm-7 8a1 1 0 0 1 1 1 5.001 5.001 0 0 0 10 0 1 1 0 1 1 2 0 7.001 7.001 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-2.07A7.001 7.001 0 0 1 5 12a1 1 0 0 1 1-1Z" />
            </svg>
            <span className="tracking-wide">Your President Speaks</span>
            <span className="ml-1 inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-green-400 via-yellow-300 to-red-500" />
          </button>

          {isPresidentSpeaking && (
            <div className="mt-6 flex items-center justify-center gap-1">
              <style>{`
                @keyframes wave {
                  0%, 100% {
                    height: 0.5rem;
                  }
                  50% {
                    height: 2rem;
                  }
                }
                .audio-wave {
                  animation: wave 0.6s ease-in-out infinite;
                  background: linear-gradient(to top, rgb(34, 197, 94), rgb(132, 204, 22));
                  border-radius: 2px;
                }
                .wave-1 { animation-delay: 0s; }
                .wave-2 { animation-delay: 0.2s; }
                .wave-3 { animation-delay: 0.4s; }
                .wave-4 { animation-delay: 0.6s; }
                .wave-5 { animation-delay: 0.8s; }
              `}</style>
              <div className="audio-wave wave-1 w-1 h-2" />
              <div className="audio-wave wave-2 w-1 h-2" />
              <div className="audio-wave wave-3 w-1 h-2" />
              <div className="audio-wave wave-4 w-1 h-2" />
              <div className="audio-wave wave-5 w-1 h-2" />
            </div>
          )}

        </div>


      </section>





      {/* YOUR LEADERSHIP */}


      <section
        className="
          mt-8
          pt-6
          px-4
          sm:px-0
          bg-gradient-to-br
          from-green-700
          via-green-600
          to-green-500
          text-white
          rounded-2xl
          py-8
          shadow-sm
        "
      >


        <h2
          className="
            text-2xl
            font-bold
            text-center
          "
        >
          Your Leadership
        </h2>



        <p
          className="
            text-center
            text-green-100
            mt-2
          "
        >
          Based on your registered constituency
        </p>





        <div
          className="
            mt-10
            flex
            flex-col
            items-center
          "
        >


          {/* MP IMAGE */}


          <div
            className="
              relative
              w-40
              h-40
              rounded-full
              p-[6px]
              bg-gradient-to-r
              from-green-700
              via-yellow-400
              to-red-600
              shadow-md
            "
          >


            <div
              className="
                flex
                h-full
                w-full
                items-center
                justify-center
                rounded-full
                bg-slate-100
                overflow-hidden
              "
            >


              {mp?.image ? (

                <img
                  src={mp.image}
                  alt={mp.name}
                  className="
                    h-full
                    w-full
                    rounded-full
                    object-cover
                  "
                  onError={(e) => {

                    e.currentTarget.style.display = "none";

                  }}
                />

              ) : (

                <UserPlaceholder />

              )}



            </div>


          </div>





          <h3
            className="
              mt-6
              text-2xl
              font-bold
            "
          >
            {mp?.name || "Leadership not assigned"}
          </h3>





          <p
            className="
              mt-2
              text-green-100
              font-semibold
            "
          >
            {mp?.role || "Member of Parliament"}
          </p>





          <p
            className="
              mt-1
              text-green-50
            "
          >
            {mp?.constituency || constituency}
          </p>





          <p
            className="
              mt-6
              max-w-xl
              text-center
              text-green-50
              leading-relaxed
            "
          >
            {mp?.bio || "Your constituency leadership will appear here once it has been assigned."}
          </p>



        </div>



      </section>



    </div>

  );
}