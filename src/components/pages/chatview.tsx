"use client";

import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  CheckCheck,
  Users,
  Plus,
  Mic,
  Send,
  Smile,
} from "lucide-react";

import { useState } from "react";


const messages = [
  {
    id: 1,
    sender: "John Mapfumo",
    message: "Good morning Sir Lloyd 👋",
    time: "09:21",
    type: "received",
  },
  {
    id: 2,
    sender: "John Mapfumo",
    message:
      "How are preparations going for the community event?",
    time: "09:22",
    type: "received",
  },
  {
    id: 3,
    sender: "You",
    message:
      "Everything is ready. We have confirmed the venue and the team members.",
    time: "09:24",
    type: "sent",
    read: true,
  },
  {
    id: 4,
    sender: "John Mapfumo",
    message:
      "That's great! Looking forward to seeing everyone tomorrow.",
    time: "09:25",
    type: "received",
  },
  {
    id: 5,
    sender: "You",
    message:
      "The community response has been amazing so far 🙌",
    time: "09:26",
    type: "sent",
    read: true,
  },
];


interface ChatViewProps {

  chat: {
    name: string;
    online: boolean;
    group: boolean;
  };

  onBack: () => void;

}



export function ChatView({
  chat,
  onBack,
}: ChatViewProps) {



  const [message,setMessage] =
    useState("");

  const [showActions,setShowActions] =
    useState(false);



  const initials =
    chat.name
    .split(" ")
    .map((part)=>part[0])
    .join("")
    .substring(0,2);



  const isOnline =
    chat.online && !chat.group;



  return (

    <div className="
      fixed
      inset-0
      z-50
      flex
      flex-col
      overflow-hidden
      bg-[#f7f7f5]
    ">



      {/* CHAT HEADER */}


      <header className="
        flex
        items-center
        justify-between
        border-b
        border-slate-200
        bg-white/90
        px-4
        py-3
        backdrop-blur-xl
      ">


        <div className="
          flex
          items-center
          gap-3
        ">



          <button

            onClick={onBack}

            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              transition
              hover:bg-slate-100
            "

          >

            <ArrowLeft
              size={22}
              className="text-slate-700"
            />

          </button>





          {/* AVATAR */}


          <div className="
            relative
          ">


            <div className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              bg-gradient-to-br
              from-[#8B1E3F]
              to-[#C94C6A]
              font-bold
              text-white
              shadow-md
            ">


              {chat.group ? (

                <Users size={20}/>

              ) : (

                initials

              )}


            </div>



            {isOnline && (

              <span className="
                absolute
                bottom-0
                right-0
                h-3.5
                w-3.5
                rounded-full
                border-2
                border-white
                bg-green-500
              "/>

            )}



          </div>






          <div>


            <h2 className="
              text-sm
              font-bold
              text-slate-900
            ">

              {chat.name}

            </h2>



            <p className="
              mt-0.5
              text-xs
              text-slate-500
            ">


              {chat.group
                ? "Community group"
                : isOnline
                ? "Online"
                : "Offline"
              }


            </p>


          </div>


        </div>





        {/* HEADER BUTTONS */}


        <div className="
          flex
          items-center
          gap-1
        ">


          <button className="
            hidden
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            text-[#8B1E3F]
            hover:bg-pink-50
            sm:flex
          ">

            <Phone size={19}/>

          </button>



          <button className="
            hidden
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            text-[#8B1E3F]
            hover:bg-pink-50
            sm:flex
          ">

            <Video size={21}/>

          </button>




          <button className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            hover:bg-slate-100
          ">

            <MoreVertical
              size={21}
              className="text-slate-700"
            />

          </button>



        </div>


      </header>





      {/* MESSAGE AREA */}



      <main className="
        relative
        flex-1
        overflow-y-auto
        px-4
        py-6
      ">


        {/* subtle wallpaper */}


        <div className="
          pointer-events-none
          absolute
          inset-0
          opacity-[0.04]
        ">

          <div className="
            absolute
            left-1/2
            top-1/3
            -translate-x-1/2
            text-7xl
            font-black
            text-[#8B1E3F]
          ">

            Z

          </div>

        </div>





        <div className="
          relative
          z-10
        ">



          <div className="
            mb-6
            flex
            justify-center
          ">


            <span className="
              rounded-full
              bg-white
              px-4
              py-1.5
              text-xs
              font-medium
              text-slate-500
              shadow-sm
            ">

              Today

            </span>


          </div>

          {/* MESSAGES */}


          <div className="
            space-y-3
          ">


            {messages.map((item,index)=>{


              const previous =
                messages[index - 1];


              const sameSender =
                previous &&
                previous.sender === item.sender;



              return (

                <div

                  key={item.id}

                  className={`
                    flex
                    ${
                      item.type === "sent"
                      ? "justify-end"
                      : "justify-start"
                    }
                  `}

                >



                  <div className={`
                    max-w-[82%]
                    ${
                      sameSender
                      ? "mt-0.5"
                      : "mt-3"
                    }
                  `}>



                    {!sameSender &&
                    item.type === "received" && (

                      <p className="
                        mb-1
                        ml-3
                        text-[11px]
                        font-semibold
                        text-slate-400
                      ">

                        {item.sender}

                      </p>


                    )}




                    <div className={`
                      relative
                      px-4
                      py-3
                      shadow-sm
                      ${
                        item.type === "sent"

                        ?

                        `
                        rounded-2xl
                        rounded-br-md
                        bg-gradient-to-br
                        from-[#8B1E3F]
                        to-[#C94C6A]
                        text-white
                        `

                        :

                        `
                        rounded-2xl
                        rounded-bl-md
                        bg-white
                        text-slate-800
                        `
                      }

                    `}>


                      <p className="
                        text-sm
                        leading-relaxed
                      ">

                        {item.message}

                      </p>





                      <div className={`
                        mt-2
                        flex
                        items-center
                        justify-end
                        gap-1
                        text-[11px]

                        ${
                          item.type === "sent"

                          ?

                          "text-pink-100"

                          :

                          "text-slate-400"

                        }

                      `}>


                        <span>

                          {item.time}

                        </span>



                        {item.type === "sent" &&
                        item.read && (

                          <CheckCheck
                            size={15}
                            className="
                              text-yellow-300
                            "
                          />

                        )}



                      </div>


                    </div>


                  </div>



                </div>


              );


            })}


          </div>






          {/* TYPING */}



          <div className="
            mt-6
            flex
            items-center
            gap-2
          ">


            <div className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              bg-[#8B1E3F]/10
            ">

              <Users
                size={15}
                className="
                  text-[#8B1E3F]
                "
              />

            </div>



            <div className="
              rounded-full
              bg-white
              px-4
              py-2
              shadow-sm
            ">


              <div className="
                flex
                gap-1
              ">


                <span className="
                  h-2
                  w-2
                  animate-bounce
                  rounded-full
                  bg-[#8B1E3F]
                "/>


                <span className="
                  h-2
                  w-2
                  animate-bounce
                  rounded-full
                  bg-[#8B1E3F]
                  [animation-delay:150ms]
                "/>


                <span className="
                  h-2
                  w-2
                  animate-bounce
                  rounded-full
                  bg-[#8B1E3F]
                  [animation-delay:300ms]
                "/>


              </div>


            </div>


          </div>



        </div>



      </main>





      {/* ATTACHMENT MENU */}



      {showActions && (

        <div className="
          absolute
          bottom-24
          left-4
          right-4
          z-30
          rounded-3xl
          bg-white
          p-4
          shadow-2xl
        ">


          <div className="
            grid
            grid-cols-4
            gap-4
          ">


            <button className="
              flex
              flex-col
              items-center
              gap-2
              text-xs
              text-slate-600
            ">

              📷

              <span>
                Photo
              </span>

            </button>



            <button className="
              flex
              flex-col
              items-center
              gap-2
              text-xs
              text-slate-600
            ">

              📍

              <span>
                Location
              </span>

            </button>




            <button className="
              flex
              flex-col
              items-center
              gap-2
              text-xs
              text-slate-600
            ">

              📅

              <span>
                Event
              </span>

            </button>




            <button className="
              flex
              flex-col
              items-center
              gap-2
              text-xs
              text-slate-600
            ">

              📢

              <span>
                Post
              </span>

            </button>



          </div>


        </div>


      )}





      {/* MESSAGE COMPOSER */}



      <footer className="
        border-t
        border-slate-200
        bg-white/90
        px-4
        py-3
        backdrop-blur-xl
      ">


        <div className="
          flex
          items-center
          gap-3
        ">



          <button

            onClick={()=>
              setShowActions(!showActions)
            }

            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-full
              bg-slate-100
              transition
              hover:bg-slate-200
            "

          >

            <Plus
              size={22}
              className="
                text-slate-700
              "
            />


          </button>




          <div className="
            flex
            h-12
            flex-1
            items-center
            rounded-full
            border
            border-slate-200
            bg-slate-50
            px-4
          ">


            <Smile
              size={20}
              className="
                mr-3
                text-slate-400
              "
            />



            <input

              value={message}

              onChange={(e)=>
                setMessage(e.target.value)
              }

              placeholder="
                Type a message...
              "

              className="
                flex-1
                bg-transparent
                text-sm
                outline-none
              "

            />


          </div>





          {message.trim() ? (

            <button className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-[#8B1E3F]
              text-white
              shadow-lg
              transition
              hover:scale-105
            ">

              <Send size={20}/>

            </button>


          ) : (


            <button className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-[#8B1E3F]
              text-white
              shadow-lg
            ">


              <Mic size={21}/>


            </button>


          )}



        </div>



      </footer>



    </div>

  );


}