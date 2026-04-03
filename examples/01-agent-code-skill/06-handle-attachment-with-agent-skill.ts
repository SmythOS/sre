import { Agent, Scope } from '@smythos/sdk';

async function main() {
    //in this example, we will skip the native LLM image processing, and we will let the agent delegate it to the appropriate skill

    const agent = new Agent({
        id: 'image-analyser',
        name: 'Image Analyser',
        behavior: 'You are an image analyser. You are given an image and you need to analyse it',
        model: 'gpt-4o',
    });

    //First we define the skill that will handle the image
    const imgSkill = agent.addSkill({
        name: 'ImageAnalyser',
        description: 'Any attachment should be processed by this function',
        process: async ({ image_url }) => {
            //Here the image_url will be passed as smythfs:// url
            //we can extract it using agent.storage functions

            console.log(image_url);
            return 'Image analysed';
        },
    });
    //very important, we need to force the input type of image_url to Binary
    //this will tell our agent to skip the native LLM image processing, and use the agent skill instead
    imgSkill.in({
        image_url: {
            type: 'Binary',
            description: 'The image url that we will analyze',
        },
    });

    const prompt = await agent.prompt('Analyze this image please ', {
        //you can pass your attachments in files array
        //it supports local files, remote urls, smythfs:// urls, Buffers or Blobs
        files: ['https://www.vangoghgallery.com/img/starry_night_full.jpg'],
    });
    console.log(prompt);
}

main();
