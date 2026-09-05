import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const clean=(v:unknown,max:number)=>String(v??"").replace(/<[^>]*>/g,"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").trim().slice(0,max);
const safeName=(name:string)=>name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120);
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,"0")).join("");
const docs=new Set(["text/plain","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return json({error:"Method not allowed"},405);try{
 const form=await req.formData();if(clean(form.get("website"),100))return json({ok:true});const name=clean(form.get("name"),80),city=clean(form.get("city"),80),country=clean(form.get("country"),80),body=clean(form.get("body"),40000);
 const docValue=form.get("document"),documentFile=docValue instanceof File&&docValue.size?docValue:null;
 if(!name||!city||!country||(!body&&!documentFile))return json({error:"Invalid submission"},400);if(body&&body.length<20)return json({error:"Text is too short"},400);
 if(documentFile&&(!docs.has(documentFile.type)||documentFile.size>5242880))return json({error:"Invalid document"},400);
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,supabase=createClient(Deno.env.get("SUPABASE_URL")!,serviceKey);
 const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 const{data:allowed,error:rateError}=await supabase.rpc("register_submission_attempt",{target_ip_hash:await sha256(`${ip}:${serviceKey}`)});if(rateError)throw rateError;if(!allowed)return json({error:"Too many submissions"},429);
 const id=crypto.randomUUID(),folder=`${new Date().getUTCFullYear()}/${id}`;let documentPath:string|null=null;
 if(documentFile){documentPath=`${folder}/${safeName(documentFile.name)}`;const{error}=await supabase.storage.from("letter-submissions").upload(documentPath,documentFile,{contentType:documentFile.type,upsert:false});if(error)throw error}
 const{error:dbError}=await supabase.from("letter_submissions").insert({id,author_name:name,city,country,body:body||"[Texte joint au document]",document_path:documentPath,document_name:documentFile?.name??null});if(dbError)throw dbError;
 const attachments=[] as Array<{filename:string;content:string}>;if(documentFile)attachments.push({filename:documentFile.name,content:encodeBase64(await documentFile.arrayBuffer())});
 const key=Deno.env.get("RESEND_API_KEY");if(!key)throw new Error("RESEND_API_KEY is missing");const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("MAIL_FROM")||"Vichy Littéraire <onboarding@resend.dev>",to:["vichylitteraire@gmail.com"],subject:"Nouveau texte — Vichy Littéraire",text:`Nom: ${name}\nVille: ${city}\nPays: ${country}\nDate: ${new Date().toISOString()}\n\nTexte:\n${body||"[Voir le document joint]"}`,attachments})});if(!mail.ok)throw new Error("Email delivery failed");return json({ok:true});
 }catch(error){console.error(error);return json({error:"Submission failed"},500)}});
