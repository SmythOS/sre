export async function insertVector(vector, id) {
        console.log("Insert called:", { id, vector });
        return { success: true };
      }
      
      export async function searchVector(queryVector, topK = 3) {
        console.log("Search called:", { queryVector, topK });
        return { results: [] };
      }
      